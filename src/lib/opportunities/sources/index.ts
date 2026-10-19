import "server-only";
import type { Posting } from "../types";
import { fetchJson } from "./http";
import { parseArbeitnow, parseGreenhouse, parseLever, parseRemoteOk, parseRemotive } from "./parsers";

export type Collector = { id: string; label: string; run: () => Promise<Posting[]> };

/**
 * Company career pages to follow, from env:
 *   GREENHOUSE_BOARDS="stripe:Stripe,gitlab:GitLab"   (board token : display name)
 *   LEVER_SITES="netflix:Netflix"
 * Only public job-board endpoints are used. No logged-in scraping, ever.
 */
function pairs(env: string | undefined) {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [token, name] = s.split(":");
      return { token: token.trim(), name: (name ?? token).trim() };
    })
    .filter((p) => /^[a-z0-9-]{1,60}$/i.test(p.token))
    .slice(0, 50);
}

export function collectors(): Collector[] {
  const list: Collector[] = [
    // Remotive asks for at most ~4 fetches a day: schedule the cron every 6 hours.
    { id: "remotive", label: "Remotive", run: async () => parseRemotive(await fetchJson("https://remotive.com/api/remote-jobs?limit=300")) },
    { id: "remoteok", label: "Remote OK", run: async () => parseRemoteOk(await fetchJson("https://remoteok.com/api")) },
    { id: "arbeitnow", label: "Arbeitnow", run: async () => parseArbeitnow(await fetchJson("https://www.arbeitnow.com/api/job-board-api")) },
  ];
  for (const b of pairs(process.env.GREENHOUSE_BOARDS)) {
    list.push({ id: `greenhouse:${b.token}`, label: `${b.name} (Greenhouse)`, run: async () => parseGreenhouse(await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${b.token}/jobs?content=true`), b.name) });
  }
  for (const s of pairs(process.env.LEVER_SITES)) {
    list.push({ id: `lever:${s.token}`, label: `${s.name} (Lever)`, run: async () => parseLever(await fetchJson(`https://api.lever.co/v0/postings/${s.token}?mode=json`), s.name) });
  }
  return list;
}

/** Runs every collector, isolates failures, and drops duplicates (same role on several boards). */
export async function collectAll(): Promise<{ postings: Posting[]; report: { id: string; ok: boolean; count: number; error?: string }[] }> {
  const results = await Promise.allSettled(collectors().map(async (c) => ({ c, postings: await c.run() })));
  const report: { id: string; ok: boolean; count: number; error?: string }[] = [];
  const byFingerprint = new Map<string, Posting>();
  const all = collectors();
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      report.push({ id: all[i].id, ok: false, count: 0, error: String(r.reason?.message ?? r.reason).slice(0, 200) });
      return;
    }
    report.push({ id: r.value.c.id, ok: true, count: r.value.postings.length });
    for (const p of r.value.postings) {
      const prev = byFingerprint.get(p.fingerprint);
      // Prefer the company's own career page, then the newest listing.
      if (!prev || (p.source === "greenhouse" || p.source === "lever" ? true : prev.source !== "greenhouse" && prev.source !== "lever" && p.postedAt > prev.postedAt)) {
        byFingerprint.set(p.fingerprint, p);
      }
    }
  });
  return { postings: [...byFingerprint.values()], report };
}
