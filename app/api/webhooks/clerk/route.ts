import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// Syncs Clerk -> Postgres. Only user.created is handled for Step 3 (self-serve
// landlord signup); tenant invitations (Step 4) and user.updated/deleted are
// TODO for later steps.
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SECRET });
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  if (evt.type !== "user.created") {
    return new Response("ignored", { status: 200 });
  }

  const user = evt.data;
  const clerkId = user.id;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) {
    return new Response("already synced", { status: 200 });
  }

  const primaryEmail =
    user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ??
    user.email_addresses[0]?.email_address;
  if (!primaryEmail) {
    return new Response("user has no email address", { status: 400 });
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || primaryEmail;
  const phone = user.phone_numbers[0]?.phone_number;

  // Only landlords self-register (spec: tenants exist only via landlord
  // invitation). Every new sign-up gets its own Clerk Organization + a
  // TRIALING PropFlow org. The org name is a placeholder — Step 4/later adds
  // a real onboarding step for landlords to name their business.
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const client = await clerkClient();
  const clerkOrg = await client.organizations.createOrganization({
    name: `${name}'s Properties`,
    createdBy: clerkId,
  });

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        clerkOrgId: clerkOrg.id,
        name: clerkOrg.name,
        trialEndsAt,
      },
    });
    await tx.user.create({
      data: {
        clerkId,
        email: primaryEmail,
        name,
        phone,
        role: "LANDLORD",
        orgId: org.id,
      },
    });
  });

  await client.users.updateUserMetadata(clerkId, {
    publicMetadata: { role: "LANDLORD" },
  });

  return new Response("synced", { status: 200 });
}
