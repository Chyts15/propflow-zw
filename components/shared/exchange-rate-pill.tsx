"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Rate = { usdToZig: number; source: string; asOf: Date; isStale: boolean } | null;

export function ExchangeRatePill({
  rate,
  cardBg,
  cardBorder,
  fgMuted,
}: {
  rate: Rate;
  cardBg: string;
  cardBorder: string;
  fgMuted: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const setRate = trpc.rent.setExchangeRate.useMutation({
    onSuccess: () => {
      toast.success("Exchange rate updated");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setRate.mutate({ usdToZig: Number(form.get("usdToZig")) });
  }

  const amber = rate?.isStale ?? false;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 font-mono text-xs"
        style={{
          backgroundColor: cardBg,
          border: `1px solid ${amber ? "#d97706" : cardBorder}`,
          color: amber ? "#fbbf24" : fgMuted,
        }}
        title={rate ? `As of ${rate.asOf.toLocaleDateString()} · ${rate.source}` : "Tap to set exchange rate"}
      >
        {rate ? `1 USD ≈ ${rate.usdToZig.toLocaleString()} ZiG` : "Set exchange rate"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set exchange rate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {rate && (
              <p className="text-sm text-muted-foreground">
                Current: 1 USD ≈ {rate.usdToZig.toLocaleString()} ZiG (as of {rate.asOf.toLocaleDateString()},{" "}
                {rate.source}
                {rate.isStale ? " — stale" : ""})
              </p>
            )}
            <div>
              <Label htmlFor="usdToZig">1 USD = ? ZiG</Label>
              <Input id="usdToZig" name="usdToZig" type="number" min={0} step="0.01" required placeholder="13500" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={setRate.isPending} className="bg-brand-primary hover:bg-brand-primary-dark">
                {setRate.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
