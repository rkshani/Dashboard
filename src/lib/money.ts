/** Money formatting shared by server and client components. */
export function fmtMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: opts.compact || Number.isInteger(amount) ? 0 : 2,
      notation: opts.compact && Math.abs(amount) >= 10000 ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(key: string, style: "short" | "long" = "long") {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", style === "long" ? { month: "long", year: "numeric", timeZone: "UTC" } : { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
