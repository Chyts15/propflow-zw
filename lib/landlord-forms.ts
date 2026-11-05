// Checks for the first-run forms (add property, add unit, invite tenant). They run in the browser
// before anything is sent, so a missing field is explained under that field instead of by the
// browser's one-at-a-time tooltip. The routers still validate everything with Zod: this is the
// friendly layer, not the trust boundary.

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function blank(value: string | undefined): boolean {
  return !value || value.trim() === "";
}

/** Parses what was typed into a number field; empty or junk is NaN, never 0. */
export function parseNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

export type PropertyFields = "name" | "address" | "suburb" | "city" | "province";

export function validateProperty(values: Record<PropertyFields, string>): FieldErrors<PropertyFields> {
  const errors: FieldErrors<PropertyFields> = {};
  if (blank(values.name)) errors.name = "Give the property a name, like Borrowdale Gardens.";
  else if (values.name.trim().length > 200) errors.name = "Use 200 characters or fewer.";
  if (blank(values.address)) errors.address = "Enter the street address.";
  else if (values.address.trim().length > 300) errors.address = "Use 300 characters or fewer.";
  if (blank(values.suburb)) errors.suburb = "Enter the suburb.";
  if (blank(values.city)) errors.city = "Enter the city.";
  if (blank(values.province)) errors.province = "Enter the province.";
  return errors;
}

export type UnitFields = "unitNumber" | "bedrooms" | "bathrooms" | "rentAmountUsd" | "depositAmount";

export function validateUnit(values: Record<UnitFields, string>): FieldErrors<UnitFields> {
  const errors: FieldErrors<UnitFields> = {};
  if (blank(values.unitNumber)) errors.unitNumber = "Enter the unit number, like 04 or 4B.";
  else if (values.unitNumber.trim().length > 20) errors.unitNumber = "Use 20 characters or fewer.";

  for (const field of ["bedrooms", "bathrooms"] as const) {
    const n = parseNumber(values[field]);
    if (!Number.isInteger(n) || n < 0 || n > 20) errors[field] = "Enter a whole number from 0 to 20.";
  }

  const rent = parseNumber(values.rentAmountUsd);
  if (!Number.isFinite(rent) || rent <= 0) errors.rentAmountUsd = "Enter the monthly rent in USD, like 250.";

  // The deposit is optional; only a typed value has to make sense.
  if (!blank(values.depositAmount)) {
    const deposit = parseNumber(values.depositAmount);
    if (!Number.isFinite(deposit) || deposit < 0) errors.depositAmount = "Enter 0 or more, or leave it empty.";
  }
  return errors;
}

export type InviteFields = "unitId" | "name" | "email" | "rentDueDay";

export function validateInvite(values: Record<InviteFields, string>): FieldErrors<InviteFields> {
  const errors: FieldErrors<InviteFields> = {};
  if (blank(values.unitId)) errors.unitId = "Choose the vacant unit this tenant is moving into.";

  if (blank(values.name)) errors.name = "Enter the tenant's name.";
  else if (values.name.trim().length > 200) errors.name = "Use 200 characters or fewer.";

  if (blank(values.email)) errors.email = "Enter the tenant's email address.";
  else if (!EMAIL.test(values.email.trim())) errors.email = "That email address doesn't look right. Example: chipo@example.co.zw";

  const day = parseNumber(values.rentDueDay);
  if (!Number.isInteger(day) || day < 1 || day > 28) errors.rentDueDay = "Enter a day from 1 to 28.";
  return errors;
}

/** The first field in `order` that has an error, so the form can move focus to it. */
export function firstErrorField<K extends string>(errors: FieldErrors<K>, order: readonly K[]): K | null {
  return order.find((k) => errors[k]) ?? null;
}
