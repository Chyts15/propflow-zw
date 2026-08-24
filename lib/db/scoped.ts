import "server-only";
import { prisma } from "@/lib/db";

/**
 * ALL org-owned data access (Property/Unit/Tenancy/Complaint/RentRecord) goes
 * through this file. Every export here REQUIRES an orgId or tenantId argument
 * — raw prisma calls on these models outside this file are a review failure.
 * See CLAUDE.md § Security First.
 */

const PAGE_SIZE = 20;

type Cursor = { cursor?: string };

// ---- Landlord-side reads (org-scoped) --------------------------------

export async function getPropertiesForOrg(orgId: string, { cursor }: Cursor = {}) {
  const items = await prisma.property.findMany({
    where: { orgId },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { units: { select: { id: true, isVacant: true } } },
  });
  return paginate(items);
}

export async function getUnitsForOrg(orgId: string, { cursor }: Cursor = {}) {
  const items = await prisma.unit.findMany({
    where: { property: { orgId } },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { property: { select: { name: true, suburb: true, city: true } } },
  });
  return paginate(items);
}

export async function getComplaintsForOrg(orgId: string, { cursor }: Cursor = {}) {
  const items = await prisma.complaint.findMany({
    where: { unit: { property: { orgId } } },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { unit: { select: { unitNumber: true, propertyId: true } } },
  });
  return paginate(items);
}

export async function getRentRecordsForOrg(
  orgId: string,
  { cursor, periodMonth, periodYear }: Cursor & { periodMonth?: number; periodYear?: number },
) {
  const items = await prisma.rentRecord.findMany({
    where: {
      unit: { property: { orgId } },
      ...(periodMonth ? { periodMonth } : {}),
      ...(periodYear ? { periodYear } : {}),
    },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { unit: { select: { unitNumber: true, propertyId: true } } },
  });
  return paginate(items);
}

export async function getTenanciesForOrg(orgId: string, { cursor }: Cursor = {}) {
  const items = await prisma.tenancy.findMany({
    where: { unit: { property: { orgId } } },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { id: true, name: true, phone: true, email: true, smsOptIn: true } },
      unit: { select: { unitNumber: true, propertyId: true } },
    },
  });
  return paginate(items);
}

export async function getOrganization(orgId: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
}

// ---- Tenant-side reads --------------------------------------------------
// Tenant reads are scoped to tenantId, never gated by org billing status —
// see CLAUDE.md § Tier Gating & Tenant Access. These must keep working even
// when the parent org is PAST_DUE/CANCELLED.

export async function getRentHistoryForTenant(tenantId: string, { cursor }: Cursor = {}) {
  const items = await prisma.rentRecord.findMany({
    where: { tenantId },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return paginate(items);
}

export async function getComplaintsForTenant(tenantId: string, { cursor }: Cursor = {}) {
  const items = await prisma.complaint.findMany({
    where: { tenantId },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
  });
  return paginate(items);
}

// ---- helpers --------------------------------------------------------------

function paginate<T extends { id: string }>(items: T[]) {
  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
