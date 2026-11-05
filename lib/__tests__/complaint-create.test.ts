import { beforeEach, describe, expect, it, vi } from "vitest";

// createComplaintForTenant runs against a stand-in database. What is asserted is how it answers the
// same complaint sent twice under one id (the lost-response retry) and that it never reads back, or
// reports success for, a complaint that is not this tenant's own.
const db = vi.hoisted(() => ({
  complaint: { create: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { createComplaintForTenant } from "../db/scoped";

const TENANT = "tenant-1";
const UNIT = "unit-1";
const ID = "c0123456789abcdef01234567";
const fields = { title: "Water pump not working", description: "No water pressure since Monday morning", category: "Plumbing", imageUrls: [] as string[] };

const file = (over: Partial<typeof fields> = {}) => createComplaintForTenant(TENANT, UNIT, { id: ID, ...fields, ...over });
const uniqueViolation = () => Object.assign(new Error("Unique constraint failed on the fields: (`id`)"), { code: "P2002" });
const filed = { id: ID, tenantId: TENANT, unitId: UNIT, status: "OPEN", ...fields };

beforeEach(() => {
  vi.clearAllMocks();
  db.complaint.create.mockResolvedValue(filed);
});

describe("createComplaintForTenant", () => {
  it("files the complaint under the id the form chose, on the tenant's own unit", async () => {
    await file();

    expect(db.complaint.create).toHaveBeenCalledWith({ data: { id: ID, ...fields, tenantId: TENANT, unitId: UNIT } });
  });

  it("returns the filed complaint when the same complaint arrives again, instead of filing a second", async () => {
    db.complaint.create.mockRejectedValue(uniqueViolation());
    db.complaint.findFirst.mockResolvedValue(filed);

    await expect(file()).resolves.toBe(filed);

    expect(db.complaint.create).toHaveBeenCalledTimes(1);
  });

  it("looks for the earlier complaint only among this tenant's own", async () => {
    db.complaint.create.mockRejectedValue(uniqueViolation());
    db.complaint.findFirst.mockResolvedValue(filed);

    await file();

    expect(db.complaint.findFirst).toHaveBeenCalledWith({ where: { id: ID, tenantId: TENANT } });
  });

  it("refuses when the id belongs to a complaint that is not this tenant's", async () => {
    db.complaint.create.mockRejectedValue(uniqueViolation());
    db.complaint.findFirst.mockResolvedValue(null);

    await expect(file()).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it.each([
    ["title", { title: "Gate lock broken" }],
    ["description", { description: "The pump is leaking now" }],
    ["category", { category: "Electrical" }],
  ])("refuses when the id was used for a different %s, rather than claiming the new one was filed", async (_field, change) => {
    db.complaint.create.mockRejectedValue(uniqueViolation());
    db.complaint.findFirst.mockResolvedValue(filed);

    await expect(file(change)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("passes any other database error through", async () => {
    const down = Object.assign(new Error("connection reset"), { code: "P1001" });
    db.complaint.create.mockRejectedValue(down);

    await expect(file()).rejects.toBe(down);

    expect(db.complaint.findFirst).not.toHaveBeenCalled();
  });
});
