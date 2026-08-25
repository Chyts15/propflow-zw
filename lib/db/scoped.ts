import "server-only";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import type { Currency, PropertyType } from "@/generated/prisma/client";

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

export async function createPropertyForOrg(
  orgId: string,
  ownerId: string,
  data: {
    name: string;
    address: string;
    suburb: string;
    city: string;
    province: string;
    type: PropertyType;
    totalUnits: number;
    primaryCurrency: Currency;
    description?: string;
  },
) {
  return prisma.property.create({ data: { ...data, orgId, ownerId } });
}

export async function getPropertyForOrg(orgId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId },
    include: { units: { orderBy: { unitNumber: "asc" } } },
  });
  if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  return property;
}

export async function updatePropertyForOrg(
  orgId: string,
  propertyId: string,
  data: Partial<{
    name: string;
    address: string;
    suburb: string;
    city: string;
    province: string;
    type: PropertyType;
    totalUnits: number;
    primaryCurrency: Currency;
    description: string;
  }>,
) {
  const { count } = await prisma.property.updateMany({ where: { id: propertyId, orgId }, data });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  return getPropertyForOrg(orgId, propertyId);
}

export async function deletePropertyForOrg(orgId: string, propertyId: string) {
  const { count } = await prisma.property.deleteMany({ where: { id: propertyId, orgId } });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
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

export async function createUnitForOrg(
  orgId: string,
  propertyId: string,
  data: {
    unitNumber: string;
    bedrooms: number;
    bathrooms: number;
    rentAmountUsd?: number;
    rentAmountZig?: number;
    depositAmount?: number;
    description?: string;
  },
) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, orgId }, select: { id: true } });
  if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  return prisma.unit.create({ data: { ...data, propertyId } });
}

export async function getUnitForOrg(orgId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { orgId } },
    include: { property: { select: { name: true } }, tenancy: { include: { tenant: true } } },
  });
  if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
  return unit;
}

export async function updateUnitForOrg(
  orgId: string,
  unitId: string,
  data: Partial<{
    unitNumber: string;
    bedrooms: number;
    bathrooms: number;
    rentAmountUsd: number;
    rentAmountZig: number;
    depositAmount: number;
    description: string;
  }>,
) {
  const { count } = await prisma.unit.updateMany({ where: { id: unitId, property: { orgId } }, data });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
  return prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
}

export async function deleteUnitForOrg(orgId: string, unitId: string) {
  const { count } = await prisma.unit.deleteMany({ where: { id: unitId, property: { orgId } } });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
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

// ---- Tenant invitations ----------------------------------------------
// Tenant accounts never self-register — they're invited by a landlord onto a
// specific vacant unit. See CLAUDE.md § Security First / Tenant Access.

export async function getVacantUnitsForOrg(orgId: string) {
  return prisma.unit.findMany({
    where: { property: { orgId }, isVacant: true },
    include: { property: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVacantUnitForOrg(orgId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { orgId } },
    include: { property: { select: { name: true } } },
  });
  if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
  if (!unit.isVacant) throw new TRPCError({ code: "CONFLICT", message: "Unit already has a tenant" });
  return unit;
}

// ---- Dashboard ------------------------------------------------------------

export async function getDashboardStats(orgId: string) {
  const now = new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  const [units, rentRecords, openComplaints, criticalComplaints, org] = await Promise.all([
    prisma.unit.findMany({ where: { property: { orgId } }, select: { isVacant: true } }),
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, periodMonth, periodYear },
      select: { status: true, amountDueUsd: true, amountPaidUsd: true },
    }),
    prisma.complaint.count({
      where: { unit: { property: { orgId } }, status: { in: ["OPEN", "IN_PROGRESS", "PENDING_PARTS"] } },
    }),
    prisma.complaint.count({
      where: { unit: { property: { orgId } }, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "CRITICAL" },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { smsCredits: true, name: true } }),
  ]);

  const occupiedUnits = units.filter((u) => !u.isVacant).length;
  const totalUnits = units.length;
  const dueUsd = rentRecords.reduce((sum, r) => sum + r.amountDueUsd, 0);
  const collectedUsd = rentRecords.reduce((sum, r) => sum + r.amountPaidUsd, 0);
  const onTimeCollectionsPct =
    rentRecords.length === 0
      ? 0
      : Math.round((rentRecords.filter((r) => r.status === "PAID").length / rentRecords.length) * 100);

  return {
    orgName: org.name,
    smsCredits: org.smsCredits,
    totalUnits,
    occupiedUnits,
    dueUsd,
    collectedUsd,
    onTimeCollectionsPct,
    openComplaints,
    criticalComplaints,
  };
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
