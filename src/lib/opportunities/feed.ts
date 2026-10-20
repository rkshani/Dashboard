import "server-only";
import type { Repo } from "@/lib/data/repo";
import { getRates } from "@/lib/fx";
import type { Profile } from "@/lib/profile";
import { getTemplate } from "@/templates";
import { scorePosting, type MatchContext } from "./match";
import type { FeedItem } from "./types";

export const POSTING_ID = /^[a-z]+:[A-Za-z0-9_-]{1,120}$/;

/** All recent postings, scored for this user, with their own pipeline status attached. */
export async function getFeed(repo: Repo, profile: Profile, ctx: MatchContext = {}): Promise<FeedItem[]> {
  const [postings, statuses, fx] = await Promise.all([repo.listPostings(), repo.listOpportunityStatuses(), ctx.fx ?? getRates()]);
  ctx = { fx, rateUnit: ctx.rateUnit ?? getTemplate(profile.templateId).onboarding.rateUnit };
  const now = Date.now();
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const p of postings) {
    if (seen.has(p.fingerprint)) continue; // same role from two sources
    seen.add(p.fingerprint);
    items.push({ ...p, ...scorePosting(p, profile, now, ctx), status: statuses[p.id] ?? "new" });
  }
  return items.sort((a, b) => b.score - a.score || b.postedAt.localeCompare(a.postedAt));
}
