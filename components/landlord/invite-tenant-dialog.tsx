"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { friendlyMessage } from "@/lib/trpc-error";
import { firstErrorField, parseNumber, validateInvite, type FieldErrors, type InviteFields } from "@/lib/landlord-forms";
import { unitLabel } from "@/lib/unit-display";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FOCUS_RING } from "@/components/landlord/theme";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_TRIGGER,
  DIALOG_CONTENT,
  DIALOG_FOOTER,
  DialogTitleBlock,
  Field,
  FormError,
  SELECT_CONTENT_CLASS,
  SELECT_ITEM_CLASS,
  SELECT_TRIGGER_CLASS,
  TextField,
  fieldAria,
  focusField,
} from "@/components/landlord/dialog-kit";

type VacantUnit = { id: string; unitNumber: string; property: { name: string } };

const FIELD_ORDER = ["unitId", "name", "email", "rentDueDay"] as const satisfies readonly InviteFields[];

type Variant =
  /** The button in a page header. */
  | "header"
  /** The action on one vacant unit's row: full width on a phone. */
  | "row"
  /** The call to action inside an empty state. */
  | "empty";

export function InviteTenantDialog({
  vacantUnits,
  lockedUnitId,
  variant = "header",
  unavailable,
}: {
  /** Vacant units with no invitation waiting; these are the choices in the unit picker. */
  vacantUnits: VacantUnit[];
  /** Invite onto this unit and don't show a picker (the button sits on that unit's row). */
  lockedUnitId?: string;
  variant?: Variant;
  /** Why there is nothing to invite onto, shown beside the disabled button. */
  unavailable?: { reason: string; href?: string; hrefLabel?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<InviteFields, string>>({ unitId: "", name: "", email: "", rentDueDay: "1" });
  const [errors, setErrors] = useState<FieldErrors<InviteFields>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const options = vacantUnits.map((u) => ({ value: u.id, label: unitLabel({ unitNumber: u.unitNumber, propertyName: u.property.name }) }));
  const locked = lockedUnitId ? options.find((o) => o.value === lockedUnitId) : undefined;
  // One vacant unit is not a choice: it is chosen for the landlord.
  const preselected = locked?.value ?? (options.length === 1 ? options[0].value : "");

  const invite = trpc.tenants.invite.useMutation({
    onSuccess: (_sent, variables) => {
      toast.success(`Invitation emailed to ${variables.name}`);
      setOpen(false);
      router.refresh();
    },
    // The dialog stays open and keeps what was typed.
    onError: (err) => {
      setServerError(friendlyMessage(err));
      // The unit was filled, or already invited, since this page loaded: show the current state.
      if (err.data?.code === "CONFLICT" || err.data?.code === "NOT_FOUND") router.refresh();
    },
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues({ unitId: preselected, name: "", email: "", rentDueDay: "1" });
      setErrors({});
      setServerError(null);
    }
    setOpen(next);
  }

  function set(field: InviteFields, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const found = validateInvite(values);
    setErrors(found);
    const first = firstErrorField(found, FIELD_ORDER);
    if (first) {
      focusField(first === "unitId" ? "invite-unit" : `invite-${first}`);
      return;
    }
    invite.mutate({
      unitId: values.unitId,
      name: values.name.trim(),
      email: values.email.trim(),
      rentDueDay: parseNumber(values.rentDueDay),
    });
  }

  // The unit is what a landlord has to decide; when it is already settled, start on the name.
  const firstFieldId = preselected ? "invite-name" : "invite-unit";

  if (lockedUnitId && !locked) return null;

  if (options.length === 0) {
    const reason = unavailable?.reason ?? "There is no vacant unit to invite a tenant onto yet.";
    return (
      <div className="flex max-w-xs flex-col items-end gap-1.5 text-right">
        <Button variant="outline" disabled aria-describedby="invite-unavailable" className={BTN_TRIGGER}>
          <UserPlus className="h-4 w-4" /> INVITE TENANT
        </Button>
        <p id="invite-unavailable" className="text-xs leading-snug text-white/55">
          {reason}{" "}
          {unavailable?.href && (
            <Link href={unavailable.href} className={`${FOCUS_RING} rounded font-medium text-brand-primary-light underline underline-offset-2`}>
              {unavailable.hrefLabel ?? "Go there"}
            </Link>
          )}
        </p>
      </div>
    );
  }

  const triggerClass =
    variant === "empty"
      ? "press h-11 rounded-2xl border-transparent bg-brand-primary-dark px-5 font-mono text-xs font-medium tracking-wide text-white hover:bg-brand-primary dark:border-transparent dark:bg-brand-primary-dark"
      : variant === "row"
        ? `${BTN_TRIGGER} w-full sm:w-auto`
        : BTN_TRIGGER;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className={triggerClass} />}>
        <UserPlus className="h-4 w-4" /> INVITE TENANT
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={DIALOG_CONTENT}
        initialFocus={() => document.getElementById(firstFieldId)}
      >
        <DialogTitleBlock
          title="Invite a tenant"
          description="PropFlow emails the invitation to the tenant. They set up their free account from that email, and the unit shows as occupied once they do."
        />
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormError message={serverError} />

          {locked ? (
            <div>
              <p className="mb-1.5 text-sm leading-snug font-medium text-white/80">Unit</p>
              <p className="flex min-h-11 items-center rounded-2xl border border-[#3a2216] bg-[#150b07] px-3.5 text-base text-white">
                {locked.label}
              </p>
            </div>
          ) : (
            <Field id="invite-unit" label="Unit" error={errors.unitId}>
              <Select
                items={options}
                value={values.unitId || null}
                onValueChange={(next) => next && set("unitId", next)}
              >
                <SelectTrigger id="invite-unit" className={SELECT_TRIGGER_CLASS} {...fieldAria("invite-unit", errors.unitId)}>
                  <SelectValue placeholder="Choose a vacant unit" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className={SELECT_CONTENT_CLASS}>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value} className={SELECT_ITEM_CLASS}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <TextField
            id="invite-name"
            label="Tenant name"
            placeholder="Chipo Mutasa"
            autoComplete="off"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
          <TextField
            id="invite-email"
            label="Tenant email"
            hint="The invitation is emailed here. Check the spelling before you send."
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="chipo@example.co.zw"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
          />
          <TextField
            id="invite-rentDueDay"
            label="Rent due day of the month"
            hint="From 1 to 28. Rent for each month falls due on this day."
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={values.rentDueDay}
            onChange={(e) => set("rentDueDay", e.target.value)}
            error={errors.rentDueDay}
          />
          <DialogFooter className={DIALOG_FOOTER}>
            {/* The footer reverses on a phone, so the main action sits on top there and at the right from sm up. */}
            <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending} className={BTN_PRIMARY}>
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
