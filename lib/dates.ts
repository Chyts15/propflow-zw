// Date display in the product's one house format ("Monday, 22 June 2026"), always in
// Zimbabwe time so the server render and the browser agree and never shift a day.

import { ZIMBABWE_TZ, type Ymd } from "./rent-timing";

const long = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZIMBABWE_TZ,
});

const monthOnly = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** "Monday, 22 June 2026" for a moment or a Zimbabwe calendar day. */
export function formatLongDate(day: Date | Ymd): string {
  // A calendar day is anchored at noon UTC (2pm in Harare) so it can never land on a neighbour.
  const date =
    day instanceof Date ? day : new Date(Date.UTC(Math.floor(day / 10000), (Math.floor(day / 100) % 100) - 1, day % 100, 12));
  const parts = Object.fromEntries(long.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

/** "October" for a 1-based month number. */
export function formatMonthName(month: number): string {
  return monthOnly.format(new Date(Date.UTC(2000, month - 1, 1)));
}
