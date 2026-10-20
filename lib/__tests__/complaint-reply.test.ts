import { beforeEach, describe, expect, it, vi } from "vitest";

// addComplaintMessageForOrg runs against a stand-in database. What is asserted is how it answers a
// reply sent twice under one id (the lost-response retry) and that it never reads back, or reports
// success for, a row that is not this sender's reply on this complaint.
const db = vi.hoisted(() => ({
  complaint: { findFirst: vi.fn() },
  complaintMessage: { create: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { addComplaintMessageForOrg } from "../db/scoped";

const ORG = "org-1";
const COMPLAINT = "complaint-1";
const LANDLORD = "landlord-1";
const MESSAGE = "3f2b8a52-6d1e-4c64-9a5e-0d3a7b9c1e44";
const BODY = "The plumber is coming on Thursday.";

const send = (body = BODY) => addComplaintMessageForOrg(ORG, COMPLAINT, LANDLORD, "LANDLORD", body, [], MESSAGE);
const uniqueViolation = () => Object.assign(new Error("Unique constraint failed on the fields: (`id`)"), { code: "P2002" });
const saved = { id: MESSAGE, complaintId: COMPLAINT, senderId: LANDLORD, senderRole: "LANDLORD", body: BODY, imageUrls: [] };

beforeEach(() => {
  vi.clearAllMocks();
  db.complaint.findFirst.mockResolvedValue({ id: COMPLAINT });
  db.complaintMessage.create.mockResolvedValue(saved);
});

describe("addComplaintMessageForOrg", () => {
  it("saves the reply under the id the screen chose", async () => {
    await send();

    expect(db.complaintMessage.create).toHaveBeenCalledWith({
      data: { id: MESSAGE, complaintId: COMPLAINT, senderId: LANDLORD, senderRole: "LANDLORD", body: BODY, imageUrls: [] },
    });
  });

  it("only writes to a complaint in the landlord's own organisation", async () => {
    db.complaint.findFirst.mockResolvedValue(null);

    await expect(send()).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.complaint.findFirst).toHaveBeenCalledWith({
      where: { id: COMPLAINT, unit: { property: { orgId: ORG } } },
      select: { id: true },
    });
    expect(db.complaintMessage.create).not.toHaveBeenCalled();
  });

  it("returns the saved reply when the same reply arrives again, instead of saving a second one", async () => {
    db.complaintMessage.create.mockRejectedValue(uniqueViolation());
    db.complaintMessage.findFirst.mockResolvedValue(saved);

    await expect(send()).resolves.toBe(saved);

    expect(db.complaintMessage.create).toHaveBeenCalledTimes(1);
  });

  it("looks for the earlier reply only among this sender's messages on this complaint", async () => {
    db.complaintMessage.create.mockRejectedValue(uniqueViolation());
    db.complaintMessage.findFirst.mockResolvedValue(saved);

    await send();

    expect(db.complaintMessage.findFirst).toHaveBeenCalledWith({ where: { id: MESSAGE, complaintId: COMPLAINT, senderId: LANDLORD } });
  });

  it("refuses when the id is taken by a message that is not this sender's on this complaint", async () => {
    db.complaintMessage.create.mockRejectedValue(uniqueViolation());
    db.complaintMessage.findFirst.mockResolvedValue(null);

    await expect(send()).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses when the id was used for different words, rather than claiming the new words were saved", async () => {
    db.complaintMessage.create.mockRejectedValue(uniqueViolation());
    db.complaintMessage.findFirst.mockResolvedValue(saved);

    await expect(send("Please call me before Thursday.")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("passes any other database error through", async () => {
    const down = Object.assign(new Error("connection reset"), { code: "P1001" });
    db.complaintMessage.create.mockRejectedValue(down);

    await expect(send()).rejects.toBe(down);

    expect(db.complaintMessage.findFirst).not.toHaveBeenCalled();
  });
});
