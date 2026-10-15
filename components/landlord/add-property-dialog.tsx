"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { friendlyMessage } from "@/lib/trpc-error";
import { firstErrorField, validateProperty, type FieldErrors, type PropertyFields } from "@/lib/landlord-forms";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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

const PROPERTY_TYPES = ["FLAT", "HOUSE", "ROOM", "COTTAGE", "COMMERCIAL", "STAND"] as const;
type PropertyType = (typeof PROPERTY_TYPES)[number];

// Select shows the label for the chosen value only when it is handed the value/label pairs.
const TYPE_ITEMS = PROPERTY_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }));

const FIELD_ORDER = ["name", "address", "suburb", "city", "province"] as const satisfies readonly PropertyFields[];
const EMPTY: Record<PropertyFields, string> = { name: "", address: "", suburb: "", city: "", province: "" };

// fullLabel keeps "ADD PROPERTY" on phones too. The default shortens it to "ADD" for the
// header row on the Properties page, where space is tight; a first-run call to action
// should say what it does.
export function AddPropertyDialog({ fullLabel = false }: { fullLabel?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [type, setType] = useState<PropertyType>("FLAT");
  const [errors, setErrors] = useState<FieldErrors<PropertyFields>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const create = trpc.properties.create.useMutation({
    onSuccess: (property) => {
      toast.success(`${property.name} added. Now add its units.`);
      setOpen(false);
      // A property with no units is not useful yet: land on it with the Add unit form already open.
      router.push(`/properties/${property.id}?addUnit=1`);
    },
    // The dialog stays open and keeps what was typed.
    onError: (err) => setServerError(friendlyMessage(err)),
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues(EMPTY);
      setType("FLAT");
      setErrors({});
      setServerError(null);
    }
    setOpen(next);
  }

  function set(field: PropertyFields, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const found = validateProperty(values);
    setErrors(found);
    const first = firstErrorField(found, FIELD_ORDER);
    if (first) {
      focusField(first);
      return;
    }
    create.mutate({
      name: values.name.trim(),
      address: values.address.trim(),
      suburb: values.suburb.trim(),
      city: values.city.trim(),
      province: values.province.trim(),
      type,
      primaryCurrency: "USD",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className={`${BTN_TRIGGER} ${fullLabel ? "px-5" : ""}`} />}>
        <Plus className="h-4 w-4" />
        {fullLabel ? (
          "ADD PROPERTY"
        ) : (
          <>
            <span className="sm:hidden">ADD</span>
            <span className="hidden sm:inline">ADD PROPERTY</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className={DIALOG_CONTENT} initialFocus={() => document.getElementById("property-name")}>
        <DialogTitleBlock title="Add a property" description="Next you'll add its units and their monthly rent." />
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormError message={serverError} />
          <TextField
            id="property-name"
            label="Name"
            placeholder="Borrowdale Gardens"
            autoComplete="off"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
          <TextField
            id="property-address"
            label="Street address"
            placeholder="45 Borrowdale Road"
            autoComplete="off"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            error={errors.address}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="property-suburb"
              label="Suburb"
              placeholder="Borrowdale"
              autoComplete="off"
              value={values.suburb}
              onChange={(e) => set("suburb", e.target.value)}
              error={errors.suburb}
            />
            <TextField
              id="property-city"
              label="City"
              placeholder="Harare"
              autoComplete="off"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              error={errors.city}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="property-province"
              label="Province"
              placeholder="Harare"
              autoComplete="off"
              value={values.province}
              onChange={(e) => set("province", e.target.value)}
              error={errors.province}
            />
            <Field id="property-type" label="Type">
              <Select
                items={TYPE_ITEMS}
                value={type}
                onValueChange={(next) => next && setType(next as PropertyType)}
              >
                <SelectTrigger id="property-type" className={SELECT_TRIGGER_CLASS} {...fieldAria("property-type")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className={SELECT_CONTENT_CLASS}>
                  {TYPE_ITEMS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className={SELECT_ITEM_CLASS}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className={DIALOG_FOOTER}>
            {/* The footer reverses on a phone, so the main action sits on top there and at the right from sm up. */}
            <Button type="button" variant="outline" className={BTN_SECONDARY} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} className={BTN_PRIMARY}>
              {create.isPending ? "Adding…" : "Add property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
