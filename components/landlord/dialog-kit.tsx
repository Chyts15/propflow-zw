"use client";

import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The landlord shell is dark, but components/ui/dialog is the light shadcn default and is shared
// with the tenant side, so it is not restyled globally. These class strings dress the first-run
// dialogs (add property, add unit, invite tenant) in the Ember tokens from DESIGN.md instead,
// with 44px controls and a body that scrolls when a phone keyboard takes half the screen.

/**
 * Pinned near the top on a phone, so the field being typed in stays above the keyboard, and
 * centred from `sm` up. `dvh` and the scroll keep the footer reachable on a 360px-wide screen.
 */
export const DIALOG_CONTENT =
  "top-4 max-h-[calc(100dvh-2rem)] translate-y-0 gap-5 overflow-y-auto overscroll-contain rounded-2xl bg-[#1f130d] p-5 text-white ring-[#3a2216] sm:top-1/2 sm:max-w-md sm:-translate-y-1/2";

export const DIALOG_FOOTER =
  "mx-0 mb-0 rounded-none border-0 bg-transparent p-0 pt-1 sm:flex-row sm:justify-end";

export const INPUT_CLASS =
  "h-11 rounded-2xl border-[#3a2216] bg-[#150b07] px-3.5 text-base text-white placeholder:text-white/40 focus-visible:border-brand-primary-light focus-visible:ring-brand-primary/40 aria-invalid:border-[#f87171] aria-invalid:ring-[#f87171]/25 md:text-base dark:bg-[#150b07]";

export const SELECT_TRIGGER_CLASS =
  "h-11 w-full rounded-2xl border-[#3a2216] bg-[#150b07] px-3.5 text-base text-white data-[size=default]:h-11 data-placeholder:text-white/40 focus-visible:border-brand-primary-light focus-visible:ring-brand-primary/40 aria-invalid:border-[#f87171] aria-invalid:ring-[#f87171]/25 dark:bg-[#150b07] dark:hover:bg-[#150b07] [&_svg]:text-white/60";

export const SELECT_CONTENT_CLASS = "rounded-2xl bg-[#1f130d] text-white ring-[#3a2216]";

export const SELECT_ITEM_CLASS =
  "min-h-11 rounded-xl px-3 text-base focus:bg-white/10 focus:text-white not-data-[variant=destructive]:focus:**:text-white";

export const BTN_PRIMARY =
  "press h-11 rounded-2xl bg-brand-primary-dark px-5 font-mono text-xs font-medium tracking-wide text-white hover:bg-brand-primary disabled:opacity-60";

export const BTN_SECONDARY =
  "press h-11 rounded-2xl border-[#3a2216] bg-transparent px-5 font-mono text-xs tracking-wide text-white/80 hover:bg-white/10 hover:text-white dark:border-[#3a2216] dark:bg-transparent dark:hover:bg-white/10";

/** Outline button that opens a dialog from a page: terracotta on the dark shell, 44px tall. */
export const BTN_TRIGGER =
  "press h-11 rounded-2xl border-brand-primary/40 bg-transparent px-4 font-mono text-xs tracking-wide text-brand-primary-light hover:bg-brand-primary/10 hover:text-brand-primary-light dark:border-brand-primary/40 dark:bg-transparent";

export function DialogTitleBlock({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <DialogHeader className="pr-10">
      <DialogTitle className="font-heading text-xl leading-tight font-extrabold text-white">{title}</DialogTitle>
      {description && <DialogDescription className="text-white/60">{description}</DialogDescription>}
      <DialogClose
        render={
          <button
            type="button"
            aria-label="Close"
            className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-xl text-white/60 outline-none hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-primary-light"
          />
        }
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </DialogClose>
    </DialogHeader>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 text-sm leading-snug font-medium text-white/80">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-snug text-white/55">
          {hint}
        </p>
      )}
      <p id={`${id}-error`} aria-live="polite" className={error ? "mt-1.5 text-xs leading-snug text-[#f87171]" : "sr-only"}>
        {error}
      </p>
    </div>
  );
}

/** `aria-describedby` / `aria-invalid` for a control inside a Field, so the hint and error are read out. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...inputProps
}: { id: string; label: string; hint?: string; error?: string } & Omit<ComponentProps<typeof Input>, "id">) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Input id={id} className={`${INPUT_CLASS} ${className ?? ""}`} {...fieldAria(id, error, hint)} {...inputProps} />
    </Field>
  );
}

/** What went wrong with the whole submit (not one field). The dialog stays open with the typed values. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-2xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.15)] px-4 py-3 text-sm text-[#f87171]">
      {message}
    </div>
  );
}

/** Moves focus to a field after a failed check, so a keyboard or screen-reader user lands on the problem. */
export function focusField(id: string) {
  document.getElementById(id)?.focus();
}
