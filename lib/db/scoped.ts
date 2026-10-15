import "server-only";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import {
  balanceUsd,
  daysLate,
  dueYmd,
  isOverdueRecord,
  periodOf,
  summarizeOnTime,
  summarizeOverdue,
  ymdOf,
  type OwingRentRecord,
  type TimedRentRecord,
} from "@/lib/rent-timing";
import { afterReversal, checkPayment, paymentRefusal, proofRefusal, undoablePayment } from "@/lib/rent-payments";
import { nextPeriodEnd, type PaidTier } from "@/lib/billing-plan";
import { round2 } from "@/lib/money";
import type {
  Currency,
  PropertyType,
  ComplaintStatus,
  ComplaintPriority,
  RentStatus,
  UserRole,
  SubscriptionTier,
  Prisma,
} from "@/generated/prisma/client";

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
    /** Only the seed passes this. A new property has no units, and createUnitForOrg keeps the count true. */
    totalUnits?: number;
    primaryCurrency: Currency;
    description?: string;
  },
) {
  return prisma.property.create({ data: { ...data, totalUnits: data.totalUnits ?? 0, orgId, ownerId } });
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

export async function getUnitCountForOrg(orgId: string) {
  return prisma.unit.count({ where: { property: { orgId } } });
}

export async function getOpenComplaintsCountForOrg(orgId: string) {
  return prisma.complaint.count({
    where: { unit: { property: { orgId } }, status: { in: ["OPEN", "IN_PROGRESS", "PENDING_PARTS"] } },
  });
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
  const property = await prisma.property.findFirst({ where: { id: propertyId, orgId }, select: { id: true, name: true } });
  if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  try {
    return await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({ data: { ...data, propertyId } });
      await syncTotalUnits(tx, propertyId);
      return unit;
    });
  } catch (err) {
    // (propertyId, unitNumber) is unique. Adding "04" twice used to surface as a raw database error.
    if ((err as { code?: string } | null)?.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `${property.name} already has a Unit ${data.unitNumber}. Use a different unit number.`,
      });
    }
    throw err;
  }
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
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { orgId } }, select: { propertyId: true } });
  if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit not found" });
  await prisma.$transaction(async (tx) => {
    await tx.unit.delete({ where: { id: unitId } });
    await syncTotalUnits(tx, unit.propertyId);
  });
}

// Property.totalUnits is the number of units the property really has. It used to be a number the
// landlord typed in, which nothing created or checked, so it is now kept equal to the count.
async function syncTotalUnits(tx: Prisma.TransactionClient, propertyId: string) {
  const totalUnits = await tx.unit.count({ where: { propertyId } });
  await tx.property.update({ where: { id: propertyId }, data: { totalUnits } });
}

export async function getComplaintsForOrg(
  orgId: string,
  {
    cursor,
    statuses,
    order = "urgency",
  }: Cursor & {
    statuses?: readonly ComplaintStatus[];
    /** "urgency": most urgent first (the queue). "recent": most recently touched first (resolved ones). */
    order?: "urgency" | "recent";
  } = {},
) {
  const items = await prisma.complaint.findMany({
    where: { unit: { property: { orgId } }, ...(statuses ? { status: { in: [...statuses] } } : {}) },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    // The id is the last tiebreaker so the order is total and a cursor always lands on one row.
    orderBy:
      order === "recent"
        ? [{ updatedAt: "desc" }, { id: "desc" }]
        : [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    include: { unit: { select: { unitNumber: true, propertyId: true, property: { select: { name: true } } } } },
  });

  // Complaint.tenantId has no Prisma relation (matches the original schema
  // spec) — batch-fetch names separately rather than N+1 or adding a
  // relation just for display purposes.
  const tenantIds = [...new Set(items.map((c) => c.tenantId))];
  const tenants = await prisma.user.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));
  const withTenantName = items.map((c) => ({ ...c, tenantName: nameById.get(c.tenantId) ?? "Unknown tenant" }));

  return paginate(withTenantName);
}

export async function getComplaintForOrg(orgId: string, complaintId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, unit: { property: { orgId } } },
    include: {
      unit: { select: { unitNumber: true, propertyId: true, property: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!complaint) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });

  const [tenant, senders] = await Promise.all([
    prisma.user.findUnique({ where: { id: complaint.tenantId }, select: { name: true, phone: true } }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(complaint.messages.map((m) => m.senderId))] } },
      select: { id: true, name: true },
    }),
  ]);
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]));

  return {
    ...complaint,
    tenantName: tenant?.name ?? "Unknown tenant",
    tenantPhone: tenant?.phone ?? null,
    messages: complaint.messages.map((m) => ({ ...m, senderName: senderNameById.get(m.senderId) ?? "Unknown" })),
  };
}

export async function updateComplaintStatus(orgId: string, complaintId: string, status: ComplaintStatus) {
  const { count } = await prisma.complaint.updateMany({
    where: { id: complaintId, unit: { property: { orgId } } },
    data: { status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null },
  });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
}

export async function updateComplaintPriority(orgId: string, complaintId: string, priority: ComplaintPriority) {
  const { count } = await prisma.complaint.updateMany({
    where: { id: complaintId, unit: { property: { orgId } } },
    data: { priority },
  });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
}

export async function addComplaintMessageForOrg(
  orgId: string,
  complaintId: string,
  senderId: string,
  senderRole: UserRole,
  body: string,
  imageUrls: string[],
) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, unit: { property: { orgId } } },
    select: { id: true },
  });
  if (!complaint) throw new TRPCError({ code: "NOT_FOUND", message: "Complaint not found" });
  return prisma.complaintMessage.create({
    data: { complaintId, senderId, senderRole, body, imageUrls },
  });
}

// Tenant creates a complaint only on their own unit — ctx.tenancy.unitId
// (injected by tenantProcedure) is the source of truth, never a client-
// supplied unitId.
export async function createComplaintForTenant(
  tenantId: string,
  unitId: string,
  data: { title: string; description: string; category: string; imageUrls: string[] },
) {
  return prisma.complaint.create({
    data: { ...data, tenantId, unitId },
  });
}

export async function getRentRecordsForOrg(
  orgId: string,
  { cursor, periodMonth, periodYear }: Cursor & { periodMonth?: number; periodYear?: number },
) {
  const today = ymdOf(new Date());
  const items = await prisma.rentRecord.findMany({
    where: {
      unit: { property: { orgId } },
      ...(periodMonth ? { periodMonth } : {}),
      ...(periodYear ? { periodYear } : {}),
    },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      unit: { select: { unitNumber: true, propertyId: true, tenancy: { select: { rentDueDay: true } } } },
      // Only used to work out which payment an undo would reverse; not sent to the client.
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, amountUsd: true, method: true, createdAt: true },
      },
    },
  });

  // RentRecord.tenantId has no Prisma relation (matches the original schema
  // spec) — same batched-lookup pattern used for Complaint.
  const tenantIds = [...new Set(items.map((r) => r.tenantId))];
  const tenants = await prisma.user.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));

  const rows = items.map(({ events, unit, ...r }) => {
    const timed = timedRecord({ ...r, unit });
    const isOverdue = isOverdueRecord(timed, today);
    const lastPayment = undoablePayment(events);
    return {
      ...r,
      unit: { unitNumber: unit.unitNumber, propertyId: unit.propertyId },
      tenantName: nameById.get(r.tenantId) ?? "Unknown tenant",
      // The record has no due-date column; it is derived (see lib/rent-timing.ts) so the ledger
      // and the dashboard can never disagree about who is late.
      dueYmd: dueYmd(r.periodYear, r.periodMonth, unit.tenancy?.rentDueDay),
      isOverdue,
      daysLate: isOverdue ? daysLate(timed, today) : 0,
      balanceUsd: balanceUsd(r),
      lastPayment: lastPayment
        ? { id: lastPayment.id, amountUsd: lastPayment.amountUsd!, method: lastPayment.method, createdAt: lastPayment.createdAt }
        : null,
    };
  });

  return paginate(rows);
}

// Landlord-dashboard "Rent status" panel: the current period's records, most
// urgent first (overdue, then partial, then pending, then paid, then waived)
// so the rows a landlord has to act on are never pushed out by paid ones.
// Status enum order can't express that, so this sorts in memory. A period holds
// at most one record per unit (@@unique unitId+period) and getDashboardStats
// already reads the same set for its totals, so this is bounded by unit count;
// only `limit` rows are returned.
//
// `isOverdue` is derived from the due date (see lib/rent-timing.ts), not read from
// the status: nothing in the app ever sets RentStatus.OVERDUE, so a PENDING record
// that is past due is reported as overdue here.
const RENT_URGENCY: Record<RentStatus, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2, PAID: 3, WAIVED: 4 };

export async function getRentStatusPreviewForOrg(orgId: string, limit = 5) {
  const today = ymdOf(new Date());
  const { year: periodYear, month: periodMonth } = periodOf(today);
  const records = await prisma.rentRecord.findMany({
    // This month's records, plus anything still unpaid from earlier months: the dashboard's
    // overdue total counts those, so the rows behind that total have to be listed too.
    where: {
      unit: { property: { orgId } },
      OR: [{ periodMonth, periodYear }, { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }],
    },
    select: {
      id: true,
      tenantId: true,
      amountDueUsd: true,
      amountPaidUsd: true,
      status: true,
      paymentMethod: true,
      proofImageUrl: true,
      paidAt: true,
      periodMonth: true,
      periodYear: true,
      unit: { select: { unitNumber: true, tenancy: { select: { rentDueDay: true } } } },
    },
  });

  const rows = records
    .map((r) => {
      const timed = timedRecord(r);
      const isOverdue = isOverdueRecord(timed, today);
      return { ...r, isOverdue, lateDays: isOverdue ? daysLate(timed, today) : 0 };
    })
    .sort((a, b) => {
      const proofA = a.proofImageUrl && a.status !== "PAID" ? 0 : 1;
      const proofB = b.proofImageUrl && b.status !== "PAID" ? 0 : 1;
      return (
        (a.isOverdue ? 0 : RENT_URGENCY[a.status]) - (b.isOverdue ? 0 : RENT_URGENCY[b.status]) ||
        proofA - proofB ||
        b.lateDays - a.lateDays ||
        b.amountDueUsd - a.amountDueUsd ||
        a.unit.unitNumber.localeCompare(b.unit.unitNumber, undefined, { numeric: true })
      );
    })
    .slice(0, limit);

  // RentRecord.tenantId has no Prisma relation — same batched-lookup pattern
  // as getRentRecordsForOrg, but only for the rows actually returned.
  const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
  const tenants = await prisma.user.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    id: r.id,
    unit: { unitNumber: r.unit.unitNumber },
    tenantName: nameById.get(r.tenantId) ?? "Unknown tenant",
    amountDueUsd: r.amountDueUsd,
    amountPaidUsd: r.amountPaidUsd,
    status: r.status,
    isOverdue: r.isOverdue,
    periodMonth: r.periodMonth,
    periodYear: r.periodYear,
    paymentMethod: r.paymentMethod,
    proofImageUrl: r.proofImageUrl,
  }));
}

// Adapts a Prisma rent record (with its unit's tenancy selected) to the shape the
// pure timing rules take.
function timedRecord(r: {
  status: RentStatus;
  paidAt: Date | null;
  periodMonth: number;
  periodYear: number;
  unit: { tenancy: { rentDueDay: number } | null };
}): TimedRentRecord {
  return {
    status: r.status,
    paidAt: r.paidAt,
    periodMonth: r.periodMonth,
    periodYear: r.periodYear,
    rentDueDay: r.unit.tenancy?.rentDueDay,
  };
}

// The same adapter, for the records the overdue summary needs (amounts and the unit as well).
function owingRecord(
  r: { unitId: string; amountDueUsd: number; amountPaidUsd: number } & Parameters<typeof timedRecord>[0],
): OwingRentRecord {
  return { ...timedRecord(r), unitId: r.unitId, amountDueUsd: r.amountDueUsd, amountPaidUsd: r.amountPaidUsd };
}

export async function getRentRecordForOrg(orgId: string, rentRecordId: string) {
  const record = await prisma.rentRecord.findFirst({
    where: { id: rentRecordId, unit: { property: { orgId } } },
  });
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Rent record not found" });
  return record;
}

// Spec: Security §3 — RentRecord status changes are never destructive; every
// change writes a PaymentEvent (who, what, when, previous status, new status).
//
// Records what the landlord RECEIVED, added to anything already paid. The record becomes PAID
// only when the money received covers what is due; a short payment leaves it PARTIAL with the
// balance still owed (the rules are in lib/rent-payments.ts). The old version overwrote the paid
// amount and always set PAID, so a $300 payment on $600 rent read as settled.
//
// The conditional write on updatedAt makes a second tab, or a double tap, fail loudly instead of
// recording the same money twice.
export async function recordRentPayment(
  orgId: string,
  actorId: string,
  input: {
    rentRecordId: string;
    method: string;
    referenceNo?: string;
    amountUsd: number;
  },
) {
  const received = round2(input.amountUsd);

  return prisma.$transaction(async (tx) => {
    const record = await tx.rentRecord.findFirst({
      where: { id: input.rentRecordId, unit: { property: { orgId } } },
    });
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Rent record not found" });

    const check = checkPayment(record, received);
    if (!check.ok) {
      throw new TRPCError({
        code: check.reason === "ALREADY_SETTLED" ? "CONFLICT" : "BAD_REQUEST",
        message: paymentRefusal(check),
      });
    }

    const { count } = await tx.rentRecord.updateMany({
      where: { id: record.id, updatedAt: record.updatedAt },
      data: {
        status: check.status,
        paymentMethod: input.method as never,
        referenceNo: input.referenceNo,
        amountPaidUsd: check.newPaidUsd,
        paidAt: check.status === "PAID" ? new Date() : null,
      },
    });
    if (count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This rent record was just changed. Refresh the page and try again.",
      });
    }

    const event = await tx.paymentEvent.create({
      data: {
        rentRecordId: record.id,
        actorId,
        source: "MANUAL",
        fromStatus: record.status,
        toStatus: check.status,
        amountUsd: received,
        method: input.method as never,
        referenceNo: input.referenceNo,
      },
    });

    const updated = await tx.rentRecord.findUniqueOrThrow({ where: { id: record.id } });
    return { record: updated, paymentEventId: event.id };
  });
}

// Takes back the latest payment still standing on a record. Money is never edited away: the undo
// is a new PaymentEvent with a NEGATIVE amount, so the event history always sums to the record's
// paid amount and shows who reversed what. Only the newest standing payment can be undone, and the
// caller names it, so a stale screen cannot reverse a different payment than the one it showed.
export async function undoRentPayment(
  orgId: string,
  actorId: string,
  input: { rentRecordId: string; paymentEventId: string },
) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.rentRecord.findFirst({
      where: { id: input.rentRecordId, unit: { property: { orgId } } },
      include: {
        events: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, amountUsd: true, method: true, referenceNo: true, createdAt: true },
        },
      },
    });
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Rent record not found" });

    const target = undoablePayment(record.events);
    if (!target || target.id !== input.paymentEventId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That payment was already undone, or a newer one was recorded. Refresh the page to see the latest.",
      });
    }

    const reversedUsd = target.amountUsd!;
    const after = afterReversal(record, reversedUsd);

    const { count } = await tx.rentRecord.updateMany({
      where: { id: record.id, updatedAt: record.updatedAt },
      data: { amountPaidUsd: after.newPaidUsd, status: after.status, paidAt: null },
    });
    if (count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This rent record was just changed. Refresh the page and try again.",
      });
    }

    await tx.paymentEvent.create({
      data: {
        rentRecordId: record.id,
        actorId,
        source: "MANUAL",
        fromStatus: record.status,
        toStatus: after.status,
        amountUsd: -reversedUsd,
        method: target.method as never,
        referenceNo: target.referenceNo,
      },
    });

    return tx.rentRecord.findUniqueOrThrow({ where: { id: record.id } });
  });
}

export async function getRentLedgerStats(orgId: string, periodMonth: number, periodYear: number) {
  const today = ymdOf(new Date());
  const [records, unpaid] = await Promise.all([
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, periodMonth, periodYear },
      select: { amountDueUsd: true, amountPaidUsd: true },
    }),
    // Every unpaid record from any period, the same set the dashboard reads for its overdue total.
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      select: {
        unitId: true,
        status: true,
        amountDueUsd: true,
        amountPaidUsd: true,
        paidAt: true,
        periodMonth: true,
        periodYear: true,
        unit: { select: { tenancy: { select: { rentDueDay: true } } } },
      },
    }),
  ]);

  const receivable = round2(records.reduce((sum, r) => sum + r.amountDueUsd, 0));
  const collected = round2(records.reduce((sum, r) => sum + r.amountPaidUsd, 0));
  const outstanding = round2(receivable - collected);

  // Overdue is derived from due dates (nothing sets RentStatus.OVERDUE), through the one shared
  // rule in lib/rent-timing.ts. It is "as of today", not per period: `overdueEarlierUsd` is the
  // part that belongs to months before the one on screen, so the page can point at it.
  const overdue = summarizeOverdue(unpaid.map(owingRecord), today);

  return {
    receivable,
    collected,
    outstanding,
    overdueUsd: overdue.usd,
    overdueUnitCount: overdue.unitCount,
    overdueEarlierUsd: overdue.usdBefore(periodYear * 100 + periodMonth),
    oldestOverdue: overdue.oldest,
  };
}

// Creates one RentRecord per active Tenancy for the given period. Called two
// ways: the monthly cron (app/api/cron/generate-rent) omits orgId to run
// across every org; the landlord's manual "Generate for this period" button
// (rent.generateForPeriod) passes ctx.orgId to scope it to their own org.
//
// Idempotent via the existing [unitId, periodMonth, periodYear] unique
// constraint — createMany + skipDuplicates rather than a new guard, so
// running this twice for the same period never duplicates records; it's a
// no-op for tenancies that already have one.
//
// Two deliberate decisions, not silent defaults:
//   - A tenancy that starts mid-period still gets a FULL month charged, not
//     a prorated amount. RentRecord has no due-date/proration field, and
//     RentStatus already has WAIVED/PARTIAL for a landlord to manually
//     adjust a partial first month — building automatic proration would mean
//     guessing a day-count convention nothing in the spec defines.
//   - rentDueDay is already capped at 1-28 by the invite input's Zod schema
//     (lib/routers/tenants.ts), so "due day past the end of the month" can't
//     occur — and RentRecord doesn't store a due date at all, so this
//     function doesn't need to compute one.
//
// A unit with only rentAmountZig set (no rentAmountUsd) is skipped, not
// defaulted to $0 — RentRecord.amountDueUsd is non-nullable and every other
// amount field in this schema (PaymentEvent, BillingEvent) treats USD as the
// canonical currency; fabricating a USD figure via the exchange rate would
// make the charge float with market rate rather than being the number the
// landlord actually set.
export async function generateRentRecordsForPeriod(periodMonth: number, periodYear: number, orgId?: string) {
  const periodStart = new Date(periodYear, periodMonth - 1, 1);
  const periodEnd = new Date(periodYear, periodMonth, 0);

  const tenancies = await prisma.tenancy.findMany({
    where: {
      isActive: true,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      ...(orgId ? { unit: { property: { orgId } } } : {}),
    },
    select: {
      unitId: true,
      tenantId: true,
      currency: true,
      unit: { select: { rentAmountUsd: true, rentAmountZig: true } },
    },
  });

  const eligible = tenancies.filter((t) => t.unit.rentAmountUsd != null);
  const rows = eligible.map((t) => ({
    unitId: t.unitId,
    tenantId: t.tenantId,
    periodMonth,
    periodYear,
    amountDueUsd: t.unit.rentAmountUsd!,
    amountDueZig: t.unit.rentAmountZig,
    currency: t.currency,
  }));

  if (rows.length === 0) {
    return { created: 0, skipped: 0, ineligible: tenancies.length - eligible.length };
  }

  const result = await prisma.rentRecord.createMany({ data: rows, skipDuplicates: true });
  return {
    created: result.count,
    skipped: rows.length - result.count,
    ineligible: tenancies.length - eligible.length,
  };
}

// System-wide (no orgId — cron-only, like expireOverdueTrials): every unpaid
// RentRecord across every org, joined with what the rent-reminder cron needs
// to compute a due date and reach the tenant.
//
// RentRecord has no direct Prisma relation to Tenancy or User (same
// denormalized tenantId/unitId pattern as Complaint — see
// getComplaintsForOrg's comment), so both are batch-fetched and joined in JS
// rather than via `include`.
//
// The due date isn't stored anywhere — it's derived from
// (periodMonth/periodYear, Tenancy.rentDueDay). This is reliably computable
// for every record here: rentDueDay is capped 1-28 at invite time (lib/routers/
// tenants.ts), so it always exists in every month including February, and
// Tenancy.unitId is unique — a unit has at most one Tenancy, ever — so a
// RentRecord (which generateRentRecordsForPeriod only ever creates from an
// active Tenancy) will always have exactly one Tenancy to look up, as long as
// that Tenancy row hasn't been deleted (nothing in this app deletes one).
// A record whose Tenancy or tenant User is missing is skipped defensively
// rather than crashing the whole sweep — this shouldn't happen given the
// above, but a reminder silently not sent is a far smaller problem than the
// cron throwing for every org because of one bad row.
export async function getUnpaidRentRecordsForReminders() {
  const records = await prisma.rentRecord.findMany({
    where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    select: {
      unitId: true,
      tenantId: true,
      periodMonth: true,
      periodYear: true,
      amountDueUsd: true,
      unit: { select: { unitNumber: true, property: { select: { orgId: true, name: true } } } },
    },
  });
  if (records.length === 0) return [];

  const unitIds = [...new Set(records.map((r) => r.unitId))];
  const tenantIds = [...new Set(records.map((r) => r.tenantId))];
  const [tenancies, tenants] = await Promise.all([
    prisma.tenancy.findMany({ where: { unitId: { in: unitIds } }, select: { unitId: true, rentDueDay: true } }),
    prisma.user.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, email: true } }),
  ]);
  const rentDueDayByUnit = new Map(tenancies.map((t) => [t.unitId, t.rentDueDay]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return records
    .map((r) => {
      const rentDueDay = rentDueDayByUnit.get(r.unitId);
      const tenant = tenantById.get(r.tenantId);
      if (rentDueDay == null || !tenant) return null;
      return {
        orgId: r.unit.property.orgId,
        unitNumber: r.unit.unitNumber,
        propertyName: r.unit.property.name,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        amountDueUsd: r.amountDueUsd,
        dueDate: new Date(r.periodYear, r.periodMonth - 1, rentDueDay),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
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

/**
 * The landlord's own vacant units among `unitIds`. This is the ownership check for invitations
 * read back from Clerk: an invitation is only this org's if its unit is returned here.
 */
export async function getVacantUnitsByIdsForOrg(orgId: string, unitIds: string[]) {
  if (unitIds.length === 0) return [];
  return prisma.unit.findMany({
    where: { id: { in: unitIds }, isVacant: true, property: { orgId } },
    select: { id: true, unitNumber: true, property: { select: { name: true } } },
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

// ---- Exchange rate ----------------------------------------------------
// Spec: lib/exchange-rate.ts — RBZ scrape cron + Redis cache are explicitly
// deferred (no verified RBZ endpoint to scrape against — see lib/exchange-rate.ts
// comment). What's real here: reading the latest rate (global scrape or a
// landlord's own manual override) and landlords setting their own override,
// which is what the ledger's currency toggle actually needs to function.

export async function getLatestExchangeRate(orgId?: string) {
  if (orgId) {
    const orgOverride = await prisma.exchangeRate.findFirst({
      where: { setByOrg: orgId },
      orderBy: { date: "desc" },
    });
    if (orgOverride) return orgOverride;
  }
  return prisma.exchangeRate.findFirst({ where: { setByOrg: null }, orderBy: { date: "desc" } });
}

export async function setManualExchangeRate(orgId: string, usdToZig: number) {
  return prisma.exchangeRate.create({
    data: { usdToZig, source: "manual", setByOrg: orgId },
  });
}

// ---- Dashboard ------------------------------------------------------------

export async function getDashboardStats(orgId: string) {
  // Periods and "today" are Zimbabwe calendar days, not the server's (UTC) — see lib/rent-timing.ts.
  const today = ymdOf(new Date());
  const { year: periodYear, month: periodMonth } = periodOf(today);
  const lastPeriodMonth = periodMonth === 1 ? 12 : periodMonth - 1;
  const lastPeriodYear = periodMonth === 1 ? periodYear - 1 : periodYear;
  // What the timing rules need from each record: when it was paid, which period it
  // belongs to, and its tenancy's due day.
  const timing = {
    paidAt: true,
    periodMonth: true,
    periodYear: true,
    unit: { select: { tenancy: { select: { rentDueDay: true } } } },
  } as const;

  const [
    units,
    propertyCount,
    rentRecords,
    lastMonthRentRecords,
    unpaidRecords,
    openComplaints,
    criticalComplaints,
    org,
  ] = await Promise.all([
    prisma.unit.findMany({ where: { property: { orgId } }, select: { isVacant: true } }),
    prisma.property.count({ where: { orgId } }),
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, periodMonth, periodYear },
      select: { status: true, amountDueUsd: true, amountPaidUsd: true, proofImageUrl: true, ...timing },
    }),
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, periodMonth: lastPeriodMonth, periodYear: lastPeriodYear },
      select: { status: true, ...timing },
    }),
    // Every unpaid record from any period: rent still owed from earlier months is overdue too.
    prisma.rentRecord.findMany({
      where: { unit: { property: { orgId } }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      select: { unitId: true, status: true, amountDueUsd: true, amountPaidUsd: true, ...timing },
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
  // On-time = paid on or before the due date, over the rent that has fallen due. Last
  // month is finished, so the two rates compare fairly even early in this month.
  const onTime = summarizeOnTime(rentRecords.map(timedRecord), today);
  const lastMonthOnTime = summarizeOnTime(lastMonthRentRecords.map(timedRecord), today);
  const onTimeCollectionsPct = onTime.pct;
  const onTimeCollectionsTrend =
    onTime.pct == null || lastMonthOnTime.pct == null ? null : onTime.pct - lastMonthOnTime.pct;

  // Money still owed past its due date (derived — nothing sets the OVERDUE status), and how
  // many tenant proofs are waiting on the landlord.
  const overdue = summarizeOverdue(unpaidRecords.map(owingRecord), today);
  const overdueUsd = overdue.usd;
  const overdueCount = overdue.unitCount;
  const proofsToReview = rentRecords.filter((r) => r.proofImageUrl && r.status !== "PAID").length;

  return {
    orgName: org.name,
    smsCredits: org.smsCredits,
    propertyCount,
    totalUnits,
    occupiedUnits,
    dueUsd,
    collectedUsd,
    rentRecordCount: rentRecords.length,
    overdueCount,
    overdueUsd,
    proofsToReview,
    onTimeCollectionsPct,
    onTimeCollectionsTrend,
    onTimeDue: onTime.due,
    onTimeCount: onTime.onTime,
    openComplaints,
    criticalComplaints,
  };
}

// ---- Tenant-side reads --------------------------------------------------
// Tenant reads are scoped to tenantId, never gated by org billing status —
// see CLAUDE.md § Tier Gating & Tenant Access. These must keep working even
// when the parent org is PAST_DUE/CANCELLED.

export async function getTenancyForTenant(tenantId: string) {
  const tenancy = await prisma.tenancy.findUnique({
    where: { tenantId },
    include: { unit: { include: { property: { select: { name: true, suburb: true, city: true } } } } },
  });
  if (!tenancy) throw new TRPCError({ code: "NOT_FOUND", message: "No active tenancy" });
  return tenancy;
}

// Used only by tenantProcedure's own middleware (lib/trpc.ts) to establish
// ctx.tenancy — returns null rather than throwing so the middleware can
// produce its own FORBIDDEN message. Kept here rather than as a raw prisma
// call in lib/trpc.ts per CLAUDE.md § Security First (no raw Tenancy queries
// outside this file).
export async function findTenancyByTenantId(tenantId: string) {
  return prisma.tenancy.findUnique({ where: { tenantId } });
}

export async function getRentHistoryForTenant(tenantId: string, { cursor }: Cursor = {}) {
  const items = await prisma.rentRecord.findMany({
    where: { tenantId },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return paginate(items);
}

// Tenant submits proof of a payment they already made directly to the
// landlord (EcoCash/bank/cash) — this is NOT the landlord confirming receipt
// (that's recordRentPayment, which is what actually writes the PaymentEvent
// per Security §3). Submitting proof only records the tenant's claim; the
// RentRecord stays PENDING until the landlord confirms via Mark Paid.
export async function submitPaymentProofForTenant(
  tenantId: string,
  rentRecordId: string,
  data: { method: string; referenceNo?: string; proofImageUrl: string },
) {
  // Evidence on rent that is already paid or waived is never replaced: a resubmission used to
  // overwrite the method and reference the landlord had confirmed.
  const record = await prisma.rentRecord.findFirst({ where: { id: rentRecordId, tenantId }, select: { status: true } });
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Rent record not found" });
  const refusal = proofRefusal(record.status);
  if (refusal) throw new TRPCError({ code: "CONFLICT", message: refusal });

  // The status check is repeated in the write so a payment confirmed a moment ago still wins.
  const { count } = await prisma.rentRecord.updateMany({
    where: { id: rentRecordId, tenantId, status: { notIn: ["PAID", "WAIVED"] } },
    data: { paymentMethod: data.method as never, referenceNo: data.referenceNo, proofImageUrl: data.proofImageUrl },
  });
  if (count === 0) {
    throw new TRPCError({ code: "CONFLICT", message: "This month was just settled, so the proof was not saved." });
  }
  return prisma.rentRecord.findUniqueOrThrow({ where: { id: rentRecordId } });
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

// The in-app SMS toggle on the tenant profile is the authoritative opt-out (CLAUDE.md § Africa-
// First); sendSms checks User.smsOptIn at send time. Scoped to the tenant's own TENANT row.
export async function setSmsOptInForTenant(tenantId: string, smsOptIn: boolean) {
  const { count } = await prisma.user.updateMany({ where: { id: tenantId, role: "TENANT" }, data: { smsOptIn } });
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  return { smsOptIn };
}

// ---- Billing (Paynow subscription + SMS bundles) — CLAUDE.md Security First:
// financial state changes always write a BillingEvent, webhooks always
// re-poll + check idempotency before mutating Organization. ----------------

type BillingMetadata = { tier: SubscriptionTier; isAnnual: boolean } | { smsQty: number };

export async function createPendingBillingEvent(
  orgId: string,
  data: { type: string; amountUsd: number; paynowRef: string; description: string; metadata: BillingMetadata },
) {
  return prisma.billingEvent.create({
    data: { orgId, status: "PENDING", ...data, metadata: data.metadata as Prisma.InputJsonValue },
  });
}

// A payment for the same thing started moments ago and still waiting on Paynow: the signature of
// a double tap. Used to refuse the second one so a landlord is not charged twice.
export async function findRecentPendingBillingEvent(orgId: string, description: string, withinMs: number) {
  return prisma.billingEvent.findFirst({
    where: { orgId, description, status: "PENDING", createdAt: { gt: new Date(Date.now() - withinMs) } },
    select: { id: true },
  });
}

export async function setBillingEventPollUrl(id: string, pollUrl: string) {
  return prisma.billingEvent.update({ where: { id }, data: { pollUrl } });
}

export async function getBillingEventByRef(paynowRef: string) {
  return prisma.billingEvent.findUnique({ where: { paynowRef } });
}

// Every attempt, not just the paid ones: a payment that is still confirming, failed, or was
// cancelled has to be visible, or a landlord who paid and returned to an unchanged page pays
// again. Callers show the status.
export async function getBillingHistoryForOrg(orgId: string) {
  return prisma.billingEvent.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

// Transitions a PENDING event exactly once — the status guard in the WHERE
// clause makes a replayed webhook a no-op (spec: Security §2 idempotency).
export async function finalizeBillingEvent(id: string, status: "PAID" | "FAILED" | "CANCELLED") {
  const { count } = await prisma.billingEvent.updateMany({ where: { id, status: "PENDING" }, data: { status } });
  return count > 0;
}

// Applies what a successful BillingEvent promised (tier switch or SMS top-up).
// Only called after finalizeBillingEvent's guard confirms this is the one
// call that gets to act on it.
export async function activateOrgFromBillingEvent(
  orgId: string,
  event: { type: string; metadata: unknown },
) {
  const meta = event.metadata as BillingMetadata | null;
  if (event.type === "SUBSCRIPTION_PAYMENT" && meta && "tier" in meta) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { tier: true, subscriptionStatus: true, isAnnual: true, currentPeriodEnd: true },
    });
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        tier: meta.tier,
        subscriptionStatus: "ACTIVE",
        isAnnual: meta.isAnnual,
        // Renewing the same active plan early extends from the current end instead of discarding
        // the days already paid for (lib/billing-plan.ts, shared with the billing page's copy).
        currentPeriodEnd: nextPeriodEnd(org, meta.tier as PaidTier, meta.isAnnual, new Date()),
        pastDueSince: null,
      },
    });
  } else if (event.type === "SMS_BUNDLE" && meta && "smsQty" in meta) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { smsCredits: { increment: meta.smsQty } },
    });
  }
}

// Billing-notification recipient: Organization.billingEmail if the landlord
// has set one, else the org's creating LANDLORD user's email. User.email is
// Clerk-managed and can go stale (the Clerk webhook only handles
// user.created, not user.updated — see app/api/webhooks/clerk/route.ts) but
// it's the best fallback we have.
export async function getBillingRecipientsForOrg(orgId: string): Promise<string[]> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { billingEmail: true } });
  if (org?.billingEmail) return [org.billingEmail];

  const landlord = await prisma.user.findFirst({
    where: { orgId, role: "LANDLORD" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  return landlord ? [landlord.email] : [];
}

// Daily cron: expired trials that never paid become PAST_DUE. Never deletes
// data — read-only gating (landlordWriteProcedure) is what actually bites,
// once 7 days past pastDueSince (spec: "PAST_DUE = read-only after 7-day grace").
//
// Select-then-update inside a transaction (rather than a bare updateMany) so
// the caller learns exactly which orgs transitioned and can email them —
// a bare updateMany only returns a count.
export async function expireOverdueTrials() {
  return prisma.$transaction(async (tx) => {
    const orgs = await tx.organization.findMany({
      where: { subscriptionStatus: "TRIALING", trialEndsAt: { lt: new Date() } },
      select: { id: true, name: true },
    });
    if (orgs.length === 0) return [];
    await tx.organization.updateMany({
      where: { id: { in: orgs.map((o) => o.id) } },
      data: { subscriptionStatus: "PAST_DUE", pastDueSince: new Date() },
    });
    return orgs;
  });
}

// Daily cron: ACTIVE subscriptions whose currentPeriodEnd has passed without
// a confirmed Paynow renewal become PAST_DUE. Same select-then-update shape
// as expireOverdueTrials, for the same reason.
export async function expireLapsedSubscriptions() {
  return prisma.$transaction(async (tx) => {
    const orgs = await tx.organization.findMany({
      where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { lt: new Date() } },
      select: { id: true, name: true },
    });
    if (orgs.length === 0) return [];
    await tx.organization.updateMany({
      where: { id: { in: orgs.map((o) => o.id) } },
      data: { subscriptionStatus: "PAST_DUE", pastDueSince: new Date() },
    });
    return orgs;
  });
}

// 3-day advance warning before a trial ends. trialExpiryWarnedAt guards
// against re-warning on every cron run once sent (a trial only ends once).
export async function findAndMarkTrialWarnings(withinDays = 3) {
  const threshold = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const orgs = await tx.organization.findMany({
      where: {
        subscriptionStatus: "TRIALING",
        trialEndsAt: { lte: threshold, gt: new Date() },
        trialExpiryWarnedAt: null,
      },
      select: { id: true, name: true, trialEndsAt: true },
    });
    if (orgs.length === 0) return [];
    await tx.organization.updateMany({
      where: { id: { in: orgs.map((o) => o.id) } },
      data: { trialExpiryWarnedAt: new Date() },
    });
    return orgs;
  });
}

// 3-day advance warning before a subscription renews. renewalWarnedForPeriodEnd
// stores the currentPeriodEnd a warning was already sent for (rather than a
// plain boolean/timestamp), so it naturally re-arms on the next renewal cycle
// without needing to be cleared anywhere. Two DateTime columns can't be
// compared directly in a Prisma `where`, so candidates are filtered in JS.
export async function findAndMarkRenewalWarnings(withinDays = 3) {
  const threshold = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.organization.findMany({
      where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { lte: threshold, gt: new Date() } },
      select: {
        id: true,
        name: true,
        tier: true,
        isAnnual: true,
        currentPeriodEnd: true,
        renewalWarnedForPeriodEnd: true,
      },
    });
    const due = candidates.filter((o) => o.renewalWarnedForPeriodEnd?.getTime() !== o.currentPeriodEnd?.getTime());
    if (due.length === 0) return [];
    await Promise.all(
      due.map((o) =>
        tx.organization.update({ where: { id: o.id }, data: { renewalWarnedForPeriodEnd: o.currentPeriodEnd } }),
      ),
    );
    return due;
  });
}

// ---- helpers --------------------------------------------------------------

function paginate<T extends { id: string }>(items: T[]) {
  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
