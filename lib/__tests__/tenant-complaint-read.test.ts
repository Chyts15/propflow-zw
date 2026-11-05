import { beforeEach, describe, expect, it, vi } from "vitest";

// The tenant's reads of their own complaints run against a stand-in database. What is asserted is
// that every query is limited to the tenant, that a thread reads oldest first, and that the list
// asks only for the landlord's replies.
const db = vi.hoisted(() => ({
  complaint: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { getComplaintForTenant, getComplaintsForTenant } from "../db/scoped";

const TENANT = "tenant-1";
const COMPLAINT = "c0123456789abcdef01234567";
const at = (n: number) => new Date(Date.UTC(2026, 9, n, 8, 0, 0));

beforeEach(() => vi.clearAllMocks());

describe("getComplaintForTenant", () => {
  it("looks the complaint up among the tenant's own, so another tenant's is not found", async () => {
    db.complaint.findFirst.mockResolvedValue(null);

    await expect(getComplaintForTenant(TENANT, COMPLAINT)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.complaint.findFirst.mock.calls[0][0].where).toEqual({ id: COMPLAINT, tenantId: TENANT });
  });

  it("reads the newest messages and returns them oldest first", async () => {
    // The database is asked for newest first so the cut-off keeps the latest; the page reads downwards.
    db.complaint.findFirst.mockResolvedValue({
      id: COMPLAINT,
      title: "Water pump not working",
      messages: [
        { id: "m3", senderRole: "LANDLORD", body: "Fixed.", createdAt: at(3) },
        { id: "m2", senderRole: "LANDLORD", body: "Plumber on Thursday.", createdAt: at(2) },
        { id: "m1", senderRole: "LANDLORD", body: "Seen, thanks.", createdAt: at(1) },
      ],
    });

    const complaint = await getComplaintForTenant(TENANT, COMPLAINT);

    expect(complaint.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    const include = db.complaint.findFirst.mock.calls[0][0].include.messages;
    expect(include.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(include.take).toBe(100);
  });

  it("asks for no more of a message than the page shows", async () => {
    db.complaint.findFirst.mockResolvedValue({ id: COMPLAINT, messages: [] });

    await getComplaintForTenant(TENANT, COMPLAINT);

    expect(db.complaint.findFirst.mock.calls[0][0].include.messages.select).toEqual({
      id: true,
      senderRole: true,
      body: true,
      createdAt: true,
    });
  });
});

describe("getComplaintsForTenant", () => {
  it("lists only the tenant's complaints, each with its newest landlord reply and their count", async () => {
    db.complaint.findMany.mockResolvedValue([]);

    await getComplaintsForTenant(TENANT);

    const args = db.complaint.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: TENANT });
    expect(args.include.messages).toEqual({
      where: { senderRole: "LANDLORD" },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { body: true, createdAt: true },
    });
    expect(args.include._count).toEqual({ select: { messages: { where: { senderRole: "LANDLORD" } } } });
  });

  it("still pages by cursor", async () => {
    db.complaint.findMany.mockResolvedValue([]);

    await getComplaintsForTenant(TENANT, { cursor: COMPLAINT });

    const args = db.complaint.findMany.mock.calls[0][0];
    expect(args.take).toBe(21);
    expect(args.cursor).toEqual({ id: COMPLAINT });
    expect(args.skip).toBe(1);
  });
});
