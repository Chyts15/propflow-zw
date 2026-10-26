"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/dates";
import { afterReversal } from "@/lib/rent-payments";
import { friendlyMessage } from "@/lib/trpc-error";
import { PAYMENT_LABEL, RENT_STATUS_LABEL } from "@/components/landlord/theme";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DIALOG_CONTENT,
  DIALOG_FOOTER,
  DialogTitleBlock,
  FormError,
} from "@/components/landlord/dialog-kit";

/** Takes back the latest payment on a rent record. The history keeps both entries. */
export function UndoPaymentDialog({
  rentRecordId,
  unitNumber,
  amountPaidUsd,
  payment,
  open,
  onOpenChange,
  onUndone,
}: {
  rentRecordId: string;
  unitNumber: string;
  amountPaidUsd: number;
  payment: { id: string; amountUsd: number; method: string | null; createdAt: Date };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the ledger flash the row that just changed. */
  onUndone?: (rentRecordId: string) => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const undo = trpc.rent.undoPayment.useMutation({
    onSuccess: () => {
      toast.success(`Payment on Unit ${unitNumber} undone`);
      onUndone?.(rentRecordId);
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => {
      // A newer payment, or an earlier undo, got there first: the dialog is about a payment that
      // is no longer the latest, so close it, say why, and show the current state.
      if (err.data?.code === "CONFLICT") {
        toast.error(friendlyMessage(err));
        onOpenChange(false);
        router.refresh();
        return;
      }
      // Anything else (a dropped connection, say): stay open so the landlord can try again.
      setServerError(friendlyMessage(err));
    },
  });

  const resulting = afterReversal({ amountPaidUsd }, payment.amountUsd).status;
  const method = payment.method ? (PAYMENT_LABEL[payment.method] ?? payment.method) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT}>
        <DialogTitleBlock
          title="Undo this payment?"
          description={
            <>
              Unit {unitNumber}: ${payment.amountUsd.toLocaleString("en-US")} USD{method ? ` by ${method}` : ""}, recorded on{" "}
              {formatLongDate(payment.createdAt)}. The rent goes back to {RENT_STATUS_LABEL[resulting].toLowerCase()}. The
              history keeps both entries, so nothing is lost.
            </>
          }
        />
        <FormError message={serverError} />
        <DialogFooter className={DIALOG_FOOTER}>
          {/* The footer reverses on a phone, so the main action sits on top there and at the right from sm up. */}
          <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => onOpenChange(false)}>
            Keep payment
          </Button>
          <Button
            type="button"
            disabled={undo.isPending}
            onClick={() => {
              setServerError(null);
              undo.mutate({ rentRecordId, paymentEventId: payment.id });
            }}
            className={BTN_PRIMARY}
          >
            {undo.isPending ? "Undoing…" : "Undo payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
