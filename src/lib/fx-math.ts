/** Currency conversion maths. Pure (no fetching) so it runs anywhere and can be unit tested. */
export type Rates = { base: "USD"; rates: Record<string, number>; updatedAt: string | null; live: boolean };

/**
 * Used only when live rates can't be fetched. Approximate mid-2026 values; the UI says
 * "approximate" whenever these are in use.
 */
export const FALLBACK_RATES: Rates = {
  base: "USD",
  rates: { USD: 1, PKR: 282, EUR: 0.87, GBP: 0.74, AED: 3.6725, INR: 86, CAD: 1.37, AUD: 1.53, SAR: 3.75 },
  updatedAt: null,
  live: false,
};

/** Currencies you can record money in. Totals are converted to your profile currency. */
export const MONEY_CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED", "INR", "CAD", "AUD", "SAR"] as const;

export function convert(amount: number, from: string, to: string, fx: Rates): number | null {
  if (from === to) return amount;
  const a = fx.rates[from];
  const b = fx.rates[to];
  if (!a || !b) return null;
  return (amount / a) * b;
}

/** Sums amounts in mixed currencies into one. Anything that can't be converted is reported separately. */
export function sumInto(rows: { amount: number; currency: string }[], to: string, fx: Rates) {
  let total = 0;
  let converted = false;
  const unconverted: string[] = [];
  for (const r of rows) {
    const v = convert(r.amount, r.currency, to, fx);
    if (v === null) {
      if (!unconverted.includes(r.currency)) unconverted.push(r.currency);
      continue;
    }
    if (r.currency !== to) converted = true;
    total += v;
  }
  return { total: Math.round(total * 100) / 100, converted, unconverted };
}

export type RateUnit = "hour" | "month" | "project";
const HOURS_PER_YEAR = 2080;

/** The user's minimum rate as yearly pay (null when it can't be compared, e.g. per-project rates). */
export function yearlyFromRate(rate: number | null, unit: RateUnit): number | null {
  if (!rate || rate <= 0) return null;
  if (unit === "hour") return rate * HOURS_PER_YEAR;
  if (unit === "month") return rate * 12;
  return null;
}

/**
 * Postings don't say whether a salary is hourly, monthly or yearly. Judge by size in USD:
 * under 500 is hourly, under 20,000 is monthly, otherwise yearly.
 */
export function yearlyFromPosting(min: number | null, max: number | null, currency: string | null, to: string, fx: Rates) {
  const top = max ?? min;
  if (!top || top <= 0 || !currency) return null;
  const usd = convert(top, currency, "USD", fx);
  if (usd === null) return null;
  const factor = usd < 500 ? HOURS_PER_YEAR : usd < 20000 ? 12 : 1;
  const lo = convert((min ?? top) * factor, currency, to, fx);
  const hi = convert(top * factor, currency, to, fx);
  if (lo === null || hi === null) return null;
  return { min: Math.round(lo), max: Math.round(hi), currency: to };
}

/** Copies of rows with `field` converted to `to` (rows with no rate are dropped from totals). */
export function toCurrency<T extends { currency: string }, K extends keyof T & string>(rows: T[], field: K, to: string, fx: Rates): T[] {
  return rows.flatMap((r) => {
    const v = convert(Number(r[field]), r.currency, to, fx);
    return v === null ? [] : [{ ...r, [field]: Math.round(v * 100) / 100, currency: to }];
  });
}
