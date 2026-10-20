import "server-only";

/**
 * Error reporting with no vendor lock-in:
 * - always a structured line in the server logs (Vercel → Logs),
 * - and, if ALERT_WEBHOOK_URL is set, a short alert to Slack, Discord or any webhook.
 * Alerts are throttled so a broken page can't flood the channel, and they never include
 * cookies, headers, query strings or user content.
 */
type Report = { source: string; message: string; digest?: string; path?: string; extra?: Record<string, string | number | boolean | null> };

const g = globalThis as unknown as { __alerts?: { recent: Map<string, number>; window: number[] } };
const state = (g.__alerts ??= { recent: new Map(), window: [] });

function scrubPath(p?: string) {
  if (!p) return undefined;
  return p.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").slice(0, 200);
}

function shouldAlert(key: string) {
  const now = Date.now();
  state.window = state.window.filter((t) => now - t < 3_600_000);
  if (state.window.length >= 20) return false; // max 20 alerts an hour
  const last = state.recent.get(key);
  if (last && now - last < 10 * 60_000) return false; // same error at most every 10 minutes
  state.recent.set(key, now);
  if (state.recent.size > 500) state.recent.clear();
  state.window.push(now);
  return true;
}

export async function reportError(r: Report) {
  const entry = {
    level: "error",
    source: r.source,
    message: r.message.slice(0, 500),
    digest: r.digest,
    path: scrubPath(r.path),
    ...r.extra,
    at: new Date().toISOString(),
  };
  console.error(JSON.stringify(entry));

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !/^https:\/\//.test(url)) return;
  if (!shouldAlert(`${r.source}|${entry.path}|${entry.message.slice(0, 120)}`)) return;
  const text = `⚠️ ${process.env.ALERT_APP_NAME ?? "Dashboard"} [${r.source}] ${entry.message}${entry.path ? ` at ${entry.path}` : ""}${r.digest ? ` (ref ${r.digest})` : ""}`;
  try {
    // `text` for Slack/most webhooks, `content` for Discord.
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), cache: "no-store" });
  } catch {
    /* never let alerting break the request */
  }
}
