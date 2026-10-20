import "server-only";
import type { Repo } from "@/lib/data/repo";
import { getRates } from "@/lib/fx";
import type { Profile } from "@/lib/profile";
import { getTemplate } from "@/templates";
import { scorePosting, type MatchContext } from "./match";
import type { FeedItem, Posting } from "./types";

export const POSTING_ID = /^[a-z]+:[A-Za-z0-9_-]{1,120}$/;

/**
 * Shared inputs for scoring many users in one job run. The posting pool and exchange rates are
 * the same for everyone, so the hourly job loads them once instead of once per user.
 */
export type FeedContext = MatchContext & { postings?: Posting[]; postedSinceMs?: number };

/** All recent postings, scored for this user, with their own pipeline status attached. */
export async function getFeed(repo: Repo, profile: Profile, ctx: FeedContext = {}): Promise<FeedItem[]> {
  const [all, statuses, fx] = await Promise.all([ctx.postings ?? repo.listPostings(), repo.listOpportunityStatuses(), ctx.fx ?? getRates()]);
  const postings = ctx.postedSinceMs ? all.filter((p) => Date.parse(p.postedAt) >= ctx.postedSinceMs!) : all;
  const match: MatchContext = { fx, rateUnit: ctx.rateUnit ?? getTemplate(profile.templateId).onboarding.rateUnit };
  const now = Date.now();
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const p of postings) {
    if (seen.has(p.fingerprint)) continue; // same role from two sources
    seen.add(p.fingerprint);
    items.push({ ...p, ...scorePosting(p, profile, now, match), status: statuses[p.id] ?? "new" });
  }
  return items.sort((a, b) => b.score - a.score || b.postedAt.localeCompare(a.postedAt));
}
