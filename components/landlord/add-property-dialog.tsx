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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const PROPERTY_TYPES = ["FLAT", "HOUSE", "ROOM", "COTTAGE", "COMMERCIAL", "STAND"] as const;

export function AddPropertyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const create = trpc.properties.create.useMutation({
    onSuccess: () => {
      toast.success("Property added");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate({
      name: String(form.get("name")),
      address: String(form.get("address")),
      suburb: String(form.get("suburb")),
      city: String(form.get("city")),
      province: String(form.get("province")),
      type: form.get("type") as (typeof PROPERTY_TYPES)[number],
      totalUnits: Number(form.get("totalUnits")),
      primaryCurrency: "USD",
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
        <Plus className="h-4 w-4" />
        <span className="sm:hidden">ADD</span>
        <span className="hidden sm:inline">ADD PROPERTY</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Borrowdale Gardens" />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" required placeholder="45 Borrowdale Road" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" name="suburb" required placeholder="Borrowdale" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required placeholder="Harare" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="province">Province</Label>
              <Input id="province" name="province" required placeholder="Harare" />
            </div>
            <div>
              <Label htmlFor="totalUnits">Total units</Label>
              <Input id="totalUnits" name="totalUnits" type="number" min={1} required defaultValue={1} />
            </div>
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select name="type" defaultValue="FLAT">
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending} className="bg-brand-primary hover:bg-brand-primary-dark">
              {create.isPending ? "Adding…" : "Add Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
