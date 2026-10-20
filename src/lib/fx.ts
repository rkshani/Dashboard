import "server-only";
import { FALLBACK_RATES, type Rates } from "./fx-math";

/**
 * Daily exchange rates (USD base) from ExchangeRate-API's free open endpoint, which needs no key
 * and covers PKR, AED and INR. Their terms require the "Rates By Exchange Rate API" link, which
 * the finance page shows. Cached in memory for 12 hours; on any failure we use approximate rates.
 */
const g = globalThis as unknown as { __fx?: { at: number; data: Rates } };
const TTL = 12 * 3_600_000;

export async function getRates(): Promise<Rates> {
  const hit = g.__fx;
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { result?: string; rates?: Record<string, unknown>; time_last_update_utc?: string };
    if (body.result !== "success" || !body.rates) throw new Error("bad payload");
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.rates)) if (/^[A-Z]{3}$/.test(k) && typeof v === "number" && v > 0 && Number.isFinite(v)) rates[k] = v;
    if (!rates.USD) throw new Error("no USD");
    const data: Rates = { base: "USD", rates, updatedAt: body.time_last_update_utc ?? null, live: true };
    g.__fx = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.warn("[fx] using fallback rates:", e instanceof Error ? e.message : e);
    // Retry in 30 minutes rather than on every request.
    g.__fx = { at: Date.now() - TTL + 30 * 60_000, data: FALLBACK_RATES };
    return FALLBACK_RATES;
  }
}
