import "server-only";

/** Fetch JSON from a public feed with a timeout, size cap and a clear user agent. */
export async function fetchJson(url: string, { timeoutMs = 15_000, maxBytes = 15_000_000 } = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": `${process.env.COLLECTOR_USER_AGENT ?? "DashboardJobCollector/1.0"}` },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new Error("Response too large");
    const text = await res.text();
    if (text.length > maxBytes) throw new Error("Response too large");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
