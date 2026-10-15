"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/dates";
import { afterReversal } from "@/lib/rent-payments";
import { friendlyMessage } from "@/lib/trpc-error";
import { PAYMENT_LABEL, RENT_STATUS_LABEL } from "@/components/landlord/theme";

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
  const undo = trpc.rent.undoPayment.useMutation({
    onSuccess: () => {
      toast.success(`Payment on Unit ${unitNumber} undone`);
      onUndone?.(rentRecordId);
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(friendlyMessage(err));
      // A newer payment, or an earlier undo, got there first: show the current state.
      if (err.data?.code === "CONFLICT") {
        onOpenChange(false);
        router.refresh();
      }
    },
  });

  const resulting = afterReversal({ amountPaidUsd }, payment.amountUsd).status;
  const method = payment.method ? (PAYMENT_LABEL[payment.method] ?? payment.method) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undo this payment?</DialogTitle>
          <DialogDescription>
            Unit {unitNumber}: ${payment.amountUsd.toLocaleString("en-US")} USD{method ? ` by ${method}` : ""}, recorded
            on {formatLongDate(payment.createdAt)}. The rent goes back to {RENT_STATUS_LABEL[resulting].toLowerCase()}.
            The history keeps both entries, so nothing is lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep payment
          </Button>
          <Button
            type="button"
            disabled={undo.isPending}
            onClick={() => undo.mutate({ rentRecordId, paymentEventId: payment.id })}
            className="bg-brand-primary-dark hover:bg-brand-primary"
          >
            {undo.isPending ? "Undoing…" : "Undo payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
