"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { amountOutcome, leftAfter, referenceError, referenceToSend } from "@/lib/mark-paid-form";
import { friendlyMessage } from "@/lib/trpc-error";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DIALOG_CONTENT,
  DIALOG_FOOTER,
  DialogTitleBlock,
  Field,
  FormError,
  INPUT_CLASS,
  SELECT_CONTENT_CLASS,
  SELECT_ITEM_CLASS,
  SELECT_TRIGGER_CLASS,
  TextField,
  fieldAria,
  focusField,
} from "@/components/landlord/dialog-kit";

// EcoCash first in every payment method list (CLAUDE.md § Zimbabwe Locale).
const PAYMENT_METHODS = [
  { value: "ECOCASH", label: "EcoCash" },
  { value: "ONEMONEY", label: "OneMoney" },
  { value: "INNBUCKS", label: "InnBucks" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CASH_USD", label: "Cash (USD)" },
  { value: "CASH_ZIG", label: "Cash (ZiG)" },
] as const;

type Method = (typeof PAYMENT_METHODS)[number]["value"];

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
  defaultMethod?: Method | null;
  defaultReferenceNo?: string | null;
  proofImageUrl?: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(defaultMethod ?? "ECOCASH");
  const [referenceNo, setReferenceNo] = useState(defaultReferenceNo ?? "");
  const [referenceFault, setReferenceFault] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  // Money still owed; the amount received starts there, so the common case (tenant paid in full)
  // is one tap, and a short payment is a deliberate edit rather than a silent overwrite.
  const balance = round2(Math.max(amountDueUsd - amountPaidUsd, 0));
  const [amountText, setAmountText] = useState(String(balance));
  const outcome = amountOutcome(balance, amountText);

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
    // The dialog stays open and keeps what was typed.
    onError: (err) => {
      setServerError(friendlyMessage(err));
      // Someone else changed this record first: show the current state rather than a stale one.
      if (err.data?.code === "CONFLICT") router.refresh();
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    if (outcome === "empty" || outcome === "over") return;
    const problem = referenceError(method, referenceNo);
    setReferenceFault(problem ?? undefined);
    if (problem) {
      focusField("markpaid-reference");
      return;
    }
    markPaid.mutate({
      rentRecordId,
      method,
      referenceNo: referenceToSend(method, referenceNo),
      amountUsd: round2(Number(amountText)),
    });
  }

  const owedZig = usdToZig == null ? null : Math.round(balance * usdToZig);
  const needsReference = method === "ECOCASH";
  // A proof with an EcoCash reference is one tap away; with none yet, the reference is what is missing.
  const firstFieldId = needsReference && referenceNo.trim() === "" ? "markpaid-reference" : "markpaid-amount";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={DIALOG_CONTENT}
        initialFocus={() => document.getElementById(firstFieldId)}
      >
        <DialogTitleBlock title={`Unit ${unitNumber}: record payment`} />

        <div className="rounded-2xl bg-[#150b07] p-4 text-sm">
          <p className="font-medium text-white">{tenantName}</p>
          <p className="text-white/55">Due {formatLongDate(dueYmd)}</p>
          <p className="mt-2 font-mono text-xs text-white/55 tabular-nums">
            Rent ${usd(amountDueUsd)} USD
            {amountPaidUsd > 0 && <> · paid ${usd(amountPaidUsd)}</>}
          </p>
          <p className="font-mono text-sm font-medium text-white tabular-nums">
            Still owed ${usd(balance)} USD
            {owedZig != null && <span className="font-normal text-white/55"> · about ZiG {owedZig.toLocaleString("en-US")}</span>}
          </p>
        </div>

        {proofImageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-[#150b07]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofImageUrl} alt="Tenant-submitted proof" className="h-full w-full object-contain" />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormError message={serverError} />

          <Field id="markpaid-method" label="Payment method">
            <Select
              items={PAYMENT_METHODS}
              value={method}
              onValueChange={(value) => {
                if (!value) return;
                setMethod(value as Method);
                // A reference typed for one method must not ride along on another (an EcoCash
                // reference on a cash payment would be a wrong record), so the field starts over
                // from the tenant's own proof, as it did when the input was remounted per method.
                setReferenceNo(defaultReferenceNo ?? "");
                setReferenceFault(undefined);
              }}
            >
              <SelectTrigger id="markpaid-method" className={SELECT_TRIGGER_CLASS} {...fieldAria("markpaid-method")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className={SELECT_CONTENT_CLASS}>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className={SELECT_ITEM_CLASS}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <TextField
            id="markpaid-reference"
            label={needsReference ? "EcoCash reference" : "Reference (optional)"}
            hint={needsReference ? "EC followed by 10 digits, like EC2406123456." : undefined}
            error={referenceFault}
            placeholder={needsReference ? "EC2406123456" : undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            value={referenceNo}
            onChange={(e) => {
              setReferenceNo(e.target.value);
              if (referenceFault) setReferenceFault(undefined);
            }}
          />

          <Field id="markpaid-amount" label="Amount received (USD)">
            <Input
              id="markpaid-amount"
              className={INPUT_CLASS}
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-describedby="markpaid-outcome"
              aria-invalid={outcome === "over" || undefined}
            />
            <p
              id="markpaid-outcome"
              aria-live="polite"
              className={`mt-1.5 text-xs leading-snug ${outcome === "over" ? "font-medium text-[#f87171]" : "text-white/55"}`}
            >
              {outcome === "empty" && "Enter the amount you received."}
              {outcome === "over" && `Only $${usd(balance)} USD is still owed. Enter that amount or less.`}
              {outcome === "settles" && "This settles the rent. It will be marked Paid."}
              {outcome === "partial" &&
                `Leaves $${usd(leftAfter(balance, amountText))} USD still owed. It will be marked Partial.`}
            </p>
          </Field>

          <DialogFooter className={DIALOG_FOOTER}>
            {/* The footer reverses on a phone, so the main action sits on top there and at the right from sm up. */}
            <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={markPaid.isPending || outcome === "empty" || outcome === "over"}
              className={BTN_PRIMARY}
            >
              {markPaid.isPending ? "Saving…" : outcome === "partial" ? "Record partial payment" : "Mark paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
