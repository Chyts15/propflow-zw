"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/dates";
import { round2, toCents } from "@/lib/money";
import { friendlyMessage } from "@/lib/trpc-error";

// EcoCash first in every payment method list (CLAUDE.md § Zimbabwe Locale).
const PAYMENT_METHODS = [
  { value: "ECOCASH", label: "EcoCash" },
  { value: "ONEMONEY", label: "OneMoney" },
  { value: "INNBUCKS", label: "InnBucks" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CASH_USD", label: "Cash (USD)" },
  { value: "CASH_ZIG", label: "Cash (ZiG)" },
] as const;

const usd = (n: number) => n.toLocaleString("en-US");

/** What the ledger needs to confirm a recorded payment and offer to undo it. */
export type RecordedPayment = {
  rentRecordId: string;
  unitNumber: string;
  paymentEventId: string;
  status: "PAID" | "PARTIAL";
  amountUsd: number;
  remainingUsd: number;
};

export function MarkPaidDialog({
  rentRecordId,
  unitNumber,
  tenantName,
  dueYmd,
  amountDueUsd,
  amountPaidUsd,
  usdToZig,
  open,
  onOpenChange,
  onRecorded,
  defaultMethod,
  defaultReferenceNo,
  proofImageUrl,
}: {
  rentRecordId: string;
  unitNumber: string;
  tenantName: string;
  /** Zimbabwe calendar day the rent fell due, as a sortable integer (see lib/rent-timing.ts). */
  dueYmd: number;
  amountDueUsd: number;
  /** Already received against this rent: a second payment adds to it rather than replacing it. */
  amountPaidUsd: number;
  usdToZig: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (payment: RecordedPayment) => void;
  defaultMethod?: (typeof PAYMENT_METHODS)[number]["value"] | null;
  defaultReferenceNo?: string | null;
  proofImageUrl?: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>(defaultMethod ?? "ECOCASH");

  // Money still owed; the amount received starts there, so the common case (tenant paid in full)
  // is one tap, and a short payment is a deliberate edit rather than a silent overwrite.
  const balance = round2(Math.max(amountDueUsd - amountPaidUsd, 0));
  const [amountText, setAmountText] = useState(String(balance));
  const amount = Number(amountText);
  const receivedCents = Number.isFinite(amount) ? toCents(amount) : 0;
  const outcome =
    receivedCents <= 0
      ? "empty"
      : receivedCents > toCents(balance)
        ? "over"
        : receivedCents === toCents(balance)
          ? "settles"
          : "partial";

  const markPaid = trpc.rent.markPaid.useMutation({
    onSuccess: ({ record, paymentEventId }, variables) => {
      onRecorded({
        rentRecordId,
        unitNumber,
        paymentEventId,
        status: record.status as "PAID" | "PARTIAL",
        amountUsd: variables.amountUsd,
        remainingUsd: round2(Math.max(record.amountDueUsd - record.amountPaidUsd, 0)),
      });
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(friendlyMessage(err));
      // Someone else changed this record first: show the current state rather than a stale one.
      if (err.data?.code === "CONFLICT") router.refresh();
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (outcome === "empty" || outcome === "over") return;
    const form = new FormData(e.currentTarget);
    markPaid.mutate({
      rentRecordId,
      method,
      referenceNo: form.get("referenceNo") ? String(form.get("referenceNo")) : undefined,
      amountUsd: round2(amount),
    });
  }

  const owedZig = usdToZig == null ? null : Math.round(balance * usdToZig);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unit {unitNumber}: record payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">{tenantName}</p>
          <p className="text-muted-foreground">Due {formatLongDate(dueYmd)}</p>
          <p className="mt-1 tabular-nums">
            Rent ${usd(amountDueUsd)} USD
            {amountPaidUsd > 0 && <> · paid ${usd(amountPaidUsd)}</>}
          </p>
          <p className="font-medium tabular-nums">
            Still owed ${usd(balance)} USD{owedZig != null && <span className="font-normal text-muted-foreground"> · about ZiG {owedZig.toLocaleString("en-US")}</span>}
          </p>
        </div>

        {proofImageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-lg bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofImageUrl} alt="Tenant-submitted proof" className="h-full w-full object-contain" />
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="method">Payment method</Label>
            <Select
              name="method"
              value={method}
              onValueChange={(value) => value && setMethod(value as (typeof PAYMENT_METHODS)[number]["value"])}
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {method === "ECOCASH" && (
            <div>
              <Label htmlFor="referenceNo">EcoCash reference</Label>
              <Input
                id="referenceNo"
                name="referenceNo"
                required
                placeholder="EC1234567890"
                pattern="EC\d{10}"
                defaultValue={defaultReferenceNo ?? ""}
              />
              <p className="mt-1 text-xs text-muted-foreground">Format: EC followed by 10 digits</p>
            </div>
          )}
          {method !== "ECOCASH" && (
            <div>
              <Label htmlFor="referenceNo">Reference (optional)</Label>
              <Input id="referenceNo" name="referenceNo" defaultValue={defaultReferenceNo ?? ""} />
            </div>
          )}
          <div>
            <Label htmlFor="amountUsd">Amount received (USD)</Label>
            <Input
              id="amountUsd"
              name="amountUsd"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              required
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-describedby="amount-outcome"
              aria-invalid={outcome === "over" || undefined}
            />
            <p
              id="amount-outcome"
              aria-live="polite"
              className={`mt-1 text-xs ${outcome === "over" ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              {outcome === "empty" && "Enter the amount you received."}
              {outcome === "over" && `Only $${usd(balance)} USD is still owed. Enter that amount or less.`}
              {outcome === "settles" && "This settles the rent. It will be marked Paid."}
              {outcome === "partial" &&
                `Leaves $${usd(round2(balance - amount))} USD still owed. It will be marked Partial.`}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={markPaid.isPending || outcome === "empty" || outcome === "over"}
              className="bg-brand-primary-dark hover:bg-brand-primary"
            >
              {markPaid.isPending ? "Saving…" : outcome === "partial" ? "Record partial payment" : "Mark paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
