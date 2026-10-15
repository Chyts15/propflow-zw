"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { friendlyMessage } from "@/lib/trpc-error";
import { firstErrorField, parseNumber, validateUnit, type FieldErrors, type UnitFields } from "@/lib/landlord-forms";
import { nextUnitNumber } from "@/lib/unit-display";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_TRIGGER,
  DIALOG_CONTENT,
  DIALOG_FOOTER,
  DialogTitleBlock,
  FormError,
  TextField,
  focusField,
} from "@/components/landlord/dialog-kit";

const FIELD_ORDER = ["unitNumber", "bedrooms", "bathrooms", "rentAmountUsd", "depositAmount"] as const satisfies readonly UnitFields[];
const BLANK: Record<UnitFields, string> = { unitNumber: "", bedrooms: "1", bathrooms: "1", rentAmountUsd: "", depositAmount: "" };

// The input ids are prefixed so a page with two of these dialogs (header and empty state) never
// has two elements with the same id.
const id = (field: UnitFields) => `unit-${field}`;

export function AddUnitDialog({
  propertyId,
  atCap,
  capMessage,
  defaultOpen = false,
  fullLabel = false,
}: {
  propertyId: string;
  /** Org is at/over its tier's unit cap — blur the trigger, show UpgradePrompt instead (never hard-block: the dialog just doesn't open). */
  atCap?: boolean;
  capMessage?: string;
  /** Open on first render: the landlord has just created this property and the next step is its first unit. */
  defaultOpen?: boolean;
  /** The trigger reads "ADD UNIT" on phones too (first-run call to action) rather than just "ADD". */
  fullLabel?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [values, setValues] = useState(BLANK);
  const [errors, setErrors] = useState<FieldErrors<UnitFields>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [addedAny, setAddedAny] = useState(false);
  const [saving, setSaving] = useState<"close" | "another" | null>(null);
  const unitNumberRef = useRef<HTMLInputElement>(null);

  // Every hook runs before the atCap branch below. Adding the unit that reaches the cap makes
  // router.refresh() re-render this same instance with atCap flipped to true; an early return
  // above the hooks changed the hook count between renders and React threw, which surfaced as
  // the page's generic "couldn't load" error even though the unit had saved.
  const create = trpc.units.create.useMutation({
    // The dialog stays open and keeps what was typed.
    onError: (err) => setServerError(friendlyMessage(err)),
    onSettled: () => setSaving(null),
  });

  if (atCap) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button
          disabled
          variant="outline"
          className="pointer-events-none border-brand-primary/40 font-mono text-xs tracking-wide text-brand-primary-light opacity-40 blur-[1px]"
        >
          <Plus className="h-4 w-4" /> ADD UNIT
        </Button>
        <UpgradePrompt message={capMessage ?? "You've reached your plan's unit limit."} />
      </div>
    );
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues(BLANK);
      setErrors({});
      setServerError(null);
      setAdded(null);
      setAddedAny(false);
    }
    setOpen(next);
  }

  function set(field: UnitFields, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function submit(addAnother: boolean) {
    setServerError(null);
    setAdded(null);
    const found = validateUnit(values);
    setErrors(found);
    const first = firstErrorField(found, FIELD_ORDER);
    if (first) {
      focusField(id(first));
      return;
    }

    const unitNumber = values.unitNumber.trim();
    setSaving(addAnother ? "another" : "close");
    create.mutate(
      {
        propertyId,
        unitNumber,
        bedrooms: parseNumber(values.bedrooms),
        bathrooms: parseNumber(values.bathrooms),
        rentAmountUsd: parseNumber(values.rentAmountUsd),
        depositAmount: values.depositAmount.trim() === "" ? undefined : parseNumber(values.depositAmount),
      },
      {
        onSuccess: () => {
          router.refresh();
          if (!addAnother) {
            toast.success(`Unit ${unitNumber} added`);
            setOpen(false);
            return;
          }
          // Same size and rent as the last one is the common case, so only the number moves on.
          setValues((v) => ({ ...v, unitNumber: nextUnitNumber(unitNumber) }));
          setAdded(`Unit ${unitNumber} added. Add the next one.`);
          setAddedAny(true);
          unitNumberRef.current?.focus();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className={`${BTN_TRIGGER} ${fullLabel ? "px-5" : ""}`} />}>
        <Plus className="h-4 w-4" />
        {fullLabel ? (
          "ADD UNIT"
        ) : (
          <>
            <span className="sm:hidden">ADD</span>
            <span className="hidden sm:inline">ADD UNIT</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT} initialFocus={() => document.getElementById(id("unitNumber"))}>
        <DialogTitleBlock title="Add a unit" description="Set the monthly rent now. Tenants are invited onto units." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          noValidate
          className="space-y-4"
        >
          <p
            role="status"
            className={added ? "rounded-2xl bg-[rgba(74,222,128,0.15)] px-4 py-3 text-sm text-[#4ade80]" : "sr-only"}
          >
            {added}
          </p>
          <FormError message={serverError} />
          <TextField
            id={id("unitNumber")}
            ref={unitNumberRef}
            label="Unit number"
            hint="As it appears on the door, like 04 or 4B."
            placeholder="04"
            autoComplete="off"
            value={values.unitNumber}
            onChange={(e) => set("unitNumber", e.target.value)}
            error={errors.unitNumber}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id={id("bedrooms")}
              label="Bedrooms"
              type="number"
              inputMode="numeric"
              min={0}
              value={values.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
              error={errors.bedrooms}
            />
            <TextField
              id={id("bathrooms")}
              label="Bathrooms"
              type="number"
              inputMode="numeric"
              min={0}
              value={values.bathrooms}
              onChange={(e) => set("bathrooms", e.target.value)}
              error={errors.bathrooms}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id={id("rentAmountUsd")}
              label="Monthly rent (USD)"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              placeholder="250"
              value={values.rentAmountUsd}
              onChange={(e) => set("rentAmountUsd", e.target.value)}
              error={errors.rentAmountUsd}
            />
            <TextField
              id={id("depositAmount")}
              label="Deposit (USD), optional"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="250"
              value={values.depositAmount}
              onChange={(e) => set("depositAmount", e.target.value)}
              error={errors.depositAmount}
            />
          </div>
          <DialogFooter className={DIALOG_FOOTER}>
            {/* The footer reverses on a phone, so the main action sits on top there and at the right from sm up. */}
            <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
              {addedAny ? "Done" : "Cancel"}
            </Button>
            <Button type="button" variant="outline" className={BTN_SECONDARY} disabled={create.isPending} onClick={() => submit(true)}>
              {saving === "another" ? "Adding…" : "Save and add another"}
            </Button>
            <Button type="submit" disabled={create.isPending} className={BTN_PRIMARY}>
              {saving === "close" ? "Adding…" : "Save unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
