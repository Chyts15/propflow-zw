"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function AddUnitDialog({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const create = trpc.units.create.useMutation({
    onSuccess: () => {
      toast.success("Unit added");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate({
      propertyId,
      unitNumber: String(form.get("unitNumber")),
      bedrooms: Number(form.get("bedrooms")),
      bathrooms: Number(form.get("bathrooms")),
      rentAmountUsd: form.get("rentAmountUsd") ? Number(form.get("rentAmountUsd")) : undefined,
      depositAmount: form.get("depositAmount") ? Number(form.get("depositAmount")) : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="border-brand-primary/40 font-mono text-xs tracking-wide text-brand-primary-light hover:bg-brand-primary/10"
          />
        }
      >
        <Plus className="h-4 w-4" /> ADD UNIT
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="unitNumber">Unit number</Label>
            <Input id="unitNumber" name="unitNumber" required placeholder="04" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min={0} required defaultValue={1} />
            </div>
            <div>
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input id="bathrooms" name="bathrooms" type="number" min={0} required defaultValue={1} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rentAmountUsd">Rent (USD)</Label>
              <Input id="rentAmountUsd" name="rentAmountUsd" type="number" min={0} step="0.01" placeholder="250" />
            </div>
            <div>
              <Label htmlFor="depositAmount">Deposit (USD)</Label>
              <Input id="depositAmount" name="depositAmount" type="number" min={0} step="0.01" placeholder="250" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending} className="bg-brand-primary hover:bg-brand-primary-dark">
              {create.isPending ? "Adding…" : "Add Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
