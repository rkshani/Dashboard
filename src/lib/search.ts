/** Small, dependency-free search used by the command palette. Pure so it can be unit tested. */
export type SearchKind = "client" | "project" | "task" | "invoice" | "opportunity" | "content";
export type SearchDoc = { kind: SearchKind; id: string; title: string; subtitle?: string; extra?: string; href: string; done?: boolean };
export type SearchHit = Omit<SearchDoc, "extra"> & { score: number };

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every word in the query must appear somewhere (title, subtitle or extra text).
 * Title matches beat other matches; a title that starts with the query beats everything.
 */
export function search(docs: SearchDoc[], query: string, limit = 20): SearchHit[] {
  const q = normalize(query).slice(0, 100);
  if (!q) return [];
  const words = q.split(" ").filter(Boolean).slice(0, 6);
  const hits: SearchHit[] = [];
  for (const d of docs) {
    const title = normalize(d.title);
    const rest = normalize(`${d.subtitle ?? ""} ${d.extra ?? ""}`);
    let score = 0;
    let all = true;
    for (const w of words) {
      const ti = title.indexOf(w);
      if (ti === 0) score += 6;
      else if (ti > 0) score += title[ti - 1] === " " ? 4 : 2;
      else if (rest.includes(w)) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (!all) continue;
    if (title === q) score += 10;
    else if (title.startsWith(q)) score += 5;
    if (d.done) score -= 2;
    hits.push({ kind: d.kind, id: d.id, title: d.title, subtitle: d.subtitle, href: d.href, done: d.done, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
