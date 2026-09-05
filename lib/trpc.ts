import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { Tenancy } from "@/generated/prisma/client";

export type Context = {
  clerkUserId: string | null;
  dbUser: { id: string; role: "LANDLORD" | "TENANT" | "ADMIN"; orgId: string | null } | null;
};

/**
 * `auth()` throws if Clerk's middleware hasn't run (e.g. no keys configured yet
 * during Phase 1 scaffolding) — treat that as signed-out rather than a 500.
 */
export async function createContext(): Promise<Context> {
  let clerkUserId: string | null = null;
  try {
    const session = await auth();
    clerkUserId = session.userId;
  } catch {
    clerkUserId = null;
  }

  if (!clerkUserId) return { clerkUserId: null, dbUser: null };

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, role: true, orgId: true },
  });

  return { clerkUserId, dbUser };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId || !ctx.dbUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, clerkUserId: ctx.clerkUserId, dbUser: ctx.dbUser } });
});

// requires an authenticated Clerk user with a matching User row — never
// use publicProcedure for anything that touches org-owned data.
export const protectedProcedure = t.procedure.use(requireAuth);

// requires role LANDLORD, injects ctx.orgId
export const landlordProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.dbUser.role !== "LANDLORD" || !ctx.dbUser.orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Landlord access required" });
  }
  return next({ ctx: { ...ctx, orgId: ctx.dbUser.orgId } });
});

const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// Every landlord MUTATION (never a query) goes through this instead of
// landlordProcedure directly — spec: "PAST_DUE = landlord read-only after
// 7-day grace. Never hard-block, never delete data." billing.initiate is the
// one exception (it stays on landlordProcedure) since paying is how an org
// escapes PAST_DUE in the first place.
export const landlordWriteProcedure = landlordProcedure.use(async ({ ctx, next }) => {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { subscriptionStatus: true, pastDueSince: true },
  });
  if (org.subscriptionStatus === "PAST_DUE" && org.pastDueSince) {
    const graceExpired = Date.now() - org.pastDueSince.getTime() > PAST_DUE_GRACE_MS;
    if (graceExpired) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your PropFlow subscription is past due — renew billing to make changes. Your data is safe and reads still work.",
      });
    }
  }
  return next({ ctx });
});

// requires role TENANT, injects ctx.tenancy
export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.dbUser.role !== "TENANT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant access required" });
  }
  const tenancy: Tenancy | null = await prisma.tenancy.findUnique({
    where: { tenantId: ctx.dbUser.id },
  });
  if (!tenancy) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active tenancy" });
  }
  return next({ ctx: { ...ctx, tenancy } });
});
