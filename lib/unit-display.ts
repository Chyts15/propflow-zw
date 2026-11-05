// How units and properties read on the landlord's screens. Pure, so the wording a first-time
// landlord sees ("No units yet", "Unit 04 · Borrowdale Flats") is tested rather than eyeballed.

/** "Unit 04 · Borrowdale Flats": the one label for a unit wherever it is chosen or listed. */
export function unitLabel(unit: { unitNumber: string; propertyName: string }): string {
  return `Unit ${unit.unitNumber} · ${unit.propertyName}`;
}

/** Orders unit numbers the way people read them: 2 before 10, "04" before "10", "4A" after "4". */
export function compareUnitNumbers(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** The number to offer after "04" when the landlord is adding several units in a row. */
export function nextUnitNumber(current: string): string {
  const match = /^(.*?)(\d+)$/.exec(current.trim());
  if (!match) return "";
  const [, prefix, digits] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return prefix + next;
}

/**
 * Occupancy for a property card. A property with no units has nothing to be a percentage of,
 * so it says so (and the card offers "Add unit") instead of reading "0/0 occupied".
 */
export function occupancySummary(units: ReadonlyArray<{ isVacant: boolean }>):
  | { kind: "empty" }
  | { kind: "units"; occupied: number; total: number; pct: number } {
  if (units.length === 0) return { kind: "empty" };
  const occupied = units.filter((u) => !u.isVacant).length;
  return { kind: "units", occupied, total: units.length, pct: Math.round((occupied / units.length) * 100) };
}

/** True for a row created moments ago, so the page can flash it once after "Add unit". */
export function isJustCreated(createdAt: Date | number, now: number, windowMs = 8_000): boolean {
  const created = createdAt instanceof Date ? createdAt.getTime() : createdAt;
  return now - created >= 0 && now - created < windowMs;
}
