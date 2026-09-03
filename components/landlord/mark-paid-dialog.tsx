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

// EcoCash first in every payment method list (CLAUDE.md § Zimbabwe Locale).
const PAYMENT_METHODS = [
  { value: "ECOCASH", label: "EcoCash" },
  { value: "ONEMONEY", label: "OneMoney" },
  { value: "INNBUCKS", label: "InnBucks" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CASH_USD", label: "Cash (USD)" },
  { value: "CASH_ZIG", label: "Cash (ZiG)" },
] as const;

export function MarkPaidDialog({
  rentRecordId,
  unitNumber,
  amountDueUsd,
  open,
  onOpenChange,
}: {
  rentRecordId: string;
  unitNumber: string;
  amountDueUsd: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("ECOCASH");
  const markPaid = trpc.rent.markPaid.useMutation({
    onSuccess: () => {
      toast.success(`Unit ${unitNumber} marked paid`);
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    markPaid.mutate({
      rentRecordId,
      method,
      referenceNo: form.get("referenceNo") ? String(form.get("referenceNo")) : undefined,
      amountUsd: Number(form.get("amountUsd")),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Unit {unitNumber} Paid</DialogTitle>
        </DialogHeader>
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
              <Input id="referenceNo" name="referenceNo" required placeholder="EC1234567890" pattern="EC\d{10}" />
              <p className="mt-1 text-xs text-muted-foreground">Format: EC followed by 10 digits</p>
            </div>
          )}
          {method !== "ECOCASH" && (
            <div>
              <Label htmlFor="referenceNo">Reference (optional)</Label>
              <Input id="referenceNo" name="referenceNo" />
            </div>
          )}
          <div>
            <Label htmlFor="amountUsd">Amount (USD)</Label>
            <Input
              id="amountUsd"
              name="amountUsd"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={amountDueUsd}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={markPaid.isPending} className="bg-brand-primary-dark hover:bg-brand-primary">
              {markPaid.isPending ? "Saving…" : "Mark Paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
