import { beforeEach, describe, expect, it, vi } from "vitest";

// submitPaymentProofForTenant runs against a stand-in for the transaction client, so what is
// asserted is the sequence of writes it makes: nothing is written when it refuses, and the
// PaymentEvent is created in the same transaction as the update, with the status it actually read.
const tx = vi.hoisted(() => ({
  rentRecord: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  paymentEvent: { create: vi.fn() },
}));
const transaction = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: transaction } }));

import { submitPaymentProofForTenant } from "../db/scoped";

const TENANT = "tenant-1";
const RECORD = "record-1";
const proof = { method: "ECOCASH", referenceNo: "EC1234567890", proofImageUrl: "https://files.example/rent-proofs/tenant-1/a.jpg" };

beforeEach(() => {
  vi.clearAllMocks();
  transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
  tx.rentRecord.updateMany.mockResolvedValue({ count: 1 });
  tx.rentRecord.findUniqueOrThrow.mockResolvedValue({ id: RECORD, status: "PENDING" });
});

describe("submitPaymentProofForTenant", () => {
  it("records the claim as a PaymentEvent with no amount and the status unchanged", async () => {
    tx.rentRecord.findFirst.mockResolvedValue({ status: "PARTIAL" });

    await submitPaymentProofForTenant(TENANT, RECORD, proof);

    expect(tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    const { data } = tx.paymentEvent.create.mock.calls[0][0];
    expect(data).toEqual({
      rentRecordId: RECORD,
      actorId: TENANT,
      source: "MANUAL",
      fromStatus: "PARTIAL",
      toStatus: "PARTIAL",
      method: "ECOCASH",
      referenceNo: "EC1234567890",
    });
    expect(data).not.toHaveProperty("amountUsd");
  });

  it("writes the event and the update in one transaction, the update first", async () => {
    tx.rentRecord.findFirst.mockResolvedValue({ status: "PENDING" });

    await submitPaymentProofForTenant(TENANT, RECORD, proof);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.rentRecord.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.paymentEvent.create.mock.invocationCallOrder[0]);
  });

  it("only updates a record that still has the status the event states", async () => {
    tx.rentRecord.findFirst.mockResolvedValue({ status: "OVERDUE" });

    await submitPaymentProofForTenant(TENANT, RECORD, proof);

    expect(tx.rentRecord.updateMany).toHaveBeenCalledWith({
      where: { id: RECORD, tenantId: TENANT, status: "OVERDUE" },
      data: { paymentMethod: "ECOCASH", referenceNo: "EC1234567890", proofImageUrl: proof.proofImageUrl },
    });
  });

  it("looks the record up by tenant, so another tenant's record is not found", async () => {
    tx.rentRecord.findFirst.mockResolvedValue(null);

    await expect(submitPaymentProofForTenant(TENANT, RECORD, proof)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(tx.rentRecord.findFirst).toHaveBeenCalledWith({ where: { id: RECORD, tenantId: TENANT }, select: { status: true } });
    expect(tx.rentRecord.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it.each(["PAID", "WAIVED"])("refuses %s rent and writes nothing", async (status) => {
    tx.rentRecord.findFirst.mockResolvedValue({ status });

    await expect(submitPaymentProofForTenant(TENANT, RECORD, proof)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(tx.rentRecord.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it("writes no event when the record changed between the read and the write", async () => {
    tx.rentRecord.findFirst.mockResolvedValue({ status: "PENDING" });
    tx.rentRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(submitPaymentProofForTenant(TENANT, RECORD, proof)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("proof was not saved"),
    });

    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it("leaves a payment history that undo still reads correctly", async () => {
    // A proof event has no amount, and undoablePayment skips amount-less events, so a claim made
    // after a payment can neither be reversed nor hide the payment underneath it.
    const { undoablePayment } = await import("../rent-payments");
    tx.rentRecord.findFirst.mockResolvedValue({ status: "PARTIAL" });
    await submitPaymentProofForTenant(TENANT, RECORD, proof);
    const claim = tx.paymentEvent.create.mock.calls[0][0].data;

    const history = [
      { id: "pay", amountUsd: 300, method: "ECOCASH", createdAt: new Date(2026, 9, 1) },
      { id: "claim", amountUsd: claim.amountUsd ?? null, method: claim.method, createdAt: new Date(2026, 9, 2) },
    ];
    expect(undoablePayment(history)?.id).toBe("pay");
  });
});
