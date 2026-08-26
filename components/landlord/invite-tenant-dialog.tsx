"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
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

type VacantUnit = { id: string; unitNumber: string; property: { name: string } };

export function InviteTenantDialog({ vacantUnits }: { vacantUnits: VacantUnit[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const invite = trpc.tenants.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    invite.mutate({
      unitId: String(form.get("unitId")),
      name: String(form.get("name")),
      email: String(form.get("email")),
      rentDueDay: Number(form.get("rentDueDay")),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="border-brand-primary/40 font-mono text-xs tracking-wide text-brand-primary-light hover:bg-brand-primary/10"
            disabled={vacantUnits.length === 0}
          />
        }
      >
        <UserPlus className="h-4 w-4" /> INVITE TENANT
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="unitId">Unit</Label>
            <Select name="unitId" required>
              <SelectTrigger id="unitId">
                <SelectValue placeholder="Select a vacant unit" />
              </SelectTrigger>
              <SelectContent>
                {vacantUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.property.name} — Unit {u.unitNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Tenant name</Label>
            <Input id="name" name="name" required placeholder="Chipo Mutasa" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="chipo@example.co.zw" />
          </div>
          <div>
            <Label htmlFor="rentDueDay">Rent due day of month</Label>
            <Input id="rentDueDay" name="rentDueDay" type="number" min={1} max={28} required defaultValue={1} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={invite.isPending} className="bg-brand-primary hover:bg-brand-primary-dark">
              {invite.isPending ? "Sending…" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
