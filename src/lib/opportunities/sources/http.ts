import "server-only";

/**
 * Fetch JSON from a public feed with:
 * - one deadline covering connect, headers AND reading the body (a slow drip can't hang the job),
 * - a byte cap enforced while streaming (a missing or lying Content-Length can't blow up memory),
 * - a clear user agent.
 */
export async function fetchJson(url: string, { timeoutMs = 12_000, maxBytes = 15_000_000, signal }: { timeoutMs?: number; maxBytes?: number; signal?: AbortSignal } = {}): Promise<unknown> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const ctrl = signal ? AbortSignal.any([deadline, signal]) : deadline;
  const res = await fetch(url, {
    signal: ctrl,
    headers: { Accept: "application/json", "User-Agent": `${process.env.COLLECTOR_USER_AGENT ?? "DashboardJobCollector/1.0"}` },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new Error(`HTTP ${res.status}`);
  }
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new Error("Response too large");
  }
  if (!res.body) return JSON.parse(await res.text());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

/** Rejects if `p` hasn't settled within `ms` (for work that isn't a single fetch, like parsing). */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}
