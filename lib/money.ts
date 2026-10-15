// Money helpers. Amounts are USD floats in the schema, so every comparison and sum that
// decides a status goes through cents to keep 0.1 + 0.2 style drift out of PAID vs PARTIAL.

export const toCents = (usd: number): number => Math.round(usd * 100);

export const round2 = (usd: number): number => Math.round(usd * 100) / 100;
