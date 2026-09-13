import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";

/**
 * Page-load fallback for app/api/webhooks/clerk/route.ts. The webhook is the
 * primary path for turning a Clerk signup into a `User` row, but delivery can
 * be missed or arrive after Clerk has already redirected the new user to an
 * authenticated page — so every server component that does
 * `prisma.user.findUniqueOrThrow({ where: { clerkId } })` should call this
 * instead. It re-derives the same row from the Clerk session on demand,
 * making a missed webhook self-healing rather than a permanent 500.
 *
 * Does not change the webhook's own behavior or logic — only replicates it
 * for the case where the webhook hasn't run yet.
 */
export async function getOrCreateDbUser(clerkId: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    throw new Error(`Clerk user ${clerkId} has no email address`);
  }

  const phone = clerkUser.phoneNumbers[0]?.phoneNumber;
  const metadata = clerkUser.publicMetadata as {
    role?: string;
    unitId?: string;
    name?: string;
    rentDueDay?: number;
  };
  const name = metadata.name || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || primaryEmail;

  if (metadata.role === "TENANT" && metadata.unitId) {
    return createTenantUser({ clerkId, email: primaryEmail, name, phone, unitId: metadata.unitId, rentDueDay: metadata.rentDueDay });
  }

  return createLandlordUser(client, { clerkId, email: primaryEmail, name, phone });
}

function isClerkIdConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray((err.meta as { target?: unknown } | undefined)?.target) &&
    ((err.meta as { target: string[] }).target).includes("clerkId")
  );
}

async function rereadUser(clerkId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) throw new Error(`User ${clerkId} was reported as a duplicate but is not readable`);
  return user;
}

// Mirrors the tenant branch of the webhook exactly (see route.ts) — same
// "unit already filled" race handling — but tolerates losing a concurrent
// create to the webhook (or another request) instead of throwing.
async function createTenantUser(args: {
  clerkId: string;
  email: string;
  name: string;
  phone: string | undefined;
  unitId: string;
  rentDueDay: number | undefined;
}): Promise<User> {
  try {
    return await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: args.unitId } });
      if (!unit.isVacant) {
        return tx.user.create({
          data: { clerkId: args.clerkId, email: args.email, name: args.name, phone: args.phone, role: "TENANT" },
        });
      }

      const tenantUser = await tx.user.create({
        data: { clerkId: args.clerkId, email: args.email, name: args.name, phone: args.phone, role: "TENANT" },
      });
      await tx.tenancy.create({
        data: {
          unitId: unit.id,
          tenantId: tenantUser.id,
          startDate: new Date(),
          rentDueDay: args.rentDueDay ?? 1,
          currency: unit.rentAmountUsd != null ? "USD" : "ZIG",
        },
      });
      await tx.unit.update({ where: { id: unit.id }, data: { isVacant: false } });
      return tenantUser;
    });
  } catch (err) {
    if (isClerkIdConflict(err)) return rereadUser(args.clerkId);
    throw err;
  }
}

// Landlord signup also provisions a Clerk Organization + PropFlow
// Organization (see route.ts). That external Clerk API call can't be made
// part of the Postgres transaction, so — unlike the webhook, which is the
// only writer today — this path first "claims" the User row (org-less) with
// a plain insert. Only whichever caller wins that insert goes on to create
// the orgs; a concurrent webhook delivery or a second on-demand call will
// find the claimed row via `existing`/P2002 and back off instead of creating
// a second Clerk Organization for the same person.
async function createLandlordUser(
  client: Awaited<ReturnType<typeof clerkClient>>,
  args: { clerkId: string; email: string; name: string; phone: string | undefined },
): Promise<User> {
  let claimed: User;
  try {
    claimed = await prisma.user.create({
      data: { clerkId: args.clerkId, email: args.email, name: args.name, phone: args.phone, role: "LANDLORD", orgId: null },
    });
  } catch (err) {
    if (isClerkIdConflict(err)) return waitForOrg(args.clerkId);
    throw err;
  }

  const clerkOrg = await client.organizations.createOrganization({
    name: `${args.name}'s Properties`,
    createdBy: args.clerkId,
  });

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const org = await prisma.organization.create({
    data: { clerkOrgId: clerkOrg.id, name: clerkOrg.name, trialEndsAt },
  });

  const updated = await prisma.user.update({ where: { id: claimed.id }, data: { orgId: org.id } });

  // Best-effort, same as the webhook — a failure here shouldn't fail the page load.
  await client.users.updateUserMetadata(args.clerkId, { publicMetadata: { role: "LANDLORD" } }).catch(() => {});

  return updated;
}

const ORG_POLL_DELAYS_MS = [150, 350, 750];

// We lost the claim race — someone else (the webhook, almost always) is
// already creating this landlord's org. Poll briefly for it to land rather
// than racing to create a second one.
async function waitForOrg(clerkId: string): Promise<User> {
  for (const delayMs of ORG_POLL_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (user?.orgId) return user;
  }
  throw new Error(
    `User ${clerkId} was claimed by a concurrent request but never got an orgId — refresh and try again`,
  );
}
