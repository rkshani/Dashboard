import "server-only";

/**
 * Fixed-window rate limiter.
 * - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set, counts live in Upstash Redis,
 *   so limits hold across every server instance (needed on Vercel).
 * - Without them (local dev, demo), it falls back to memory in this one process.
 * If Redis can't be reached, requests are allowed (logged), so an outage never locks users out.
 */
const mem = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = mem.get(key);
  if (!entry || entry.resetAt < now) {
    mem.set(key, { count: 1, resetAt: now + windowMs });
    if (mem.size > 10_000) for (const [k, v] of mem) if (v.resetAt < now) mem.delete(k);
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function sharedLimiterConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function rateLimit(key: string, limit = 5, windowMs = 60_000): Promise<boolean> {
  if (!sharedLimiterConfigured()) return memoryLimit(key, limit, windowMs);
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${bucket}`;
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", k],
        ["PEXPIRE", k, String(windowMs)],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const count = Number(out[0]?.result);
    if (!Number.isFinite(count)) throw new Error(out[0]?.error ?? "bad response");
    return count <= limit;
  } catch (e) {
    console.warn("[rate-limit] Redis unavailable, allowing request:", e instanceof Error ? e.message : e);
    return true;
  }
}
