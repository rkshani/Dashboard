import type { Profile } from "@/lib/profile";
import { canonicalize, expandSkills } from "./skills";
import type { Match, Posting } from "./types";

/**
 * Explainable scoring, 0–100. Deterministic and free to run, so every user's feed can be
 * scored on the fly whenever their profile changes. (An embedding model can replace the
 * skill-overlap part later without touching the UI.)
 *
 *   skills overlap   55
 *   title fit        15
 *   work place fit   10
 *   work type fit    10
 *   freshness        10
 */
const LEAD_HINT = /\b(freelance|contract|contractor|project[- ]based|part[- ]time|gig|consultant|hourly)\b/i;
const FULLTIME_HINT = /\b(full[- ]time|permanent|fte)\b/i;

export function scorePosting(p: Posting, profile: Profile, nowMs = Date.now()): Match {
  const declared = canonicalize(profile.skills);
  const mine = expandSkills(declared);
  const tags = p.tags.map((t) => t.toLowerCase());
  const matchedSkills = mine.filter((s) => tags.includes(s.toLowerCase()));
  const reasons: string[] = [];
  const cautions: string[] = [];

  // Skills: how much of the posting's stack you cover, nudged by how many of yours it uses.
  let skill = 0;
  if (tags.length && mine.length) {
    const coverage = matchedSkills.length / Math.min(tags.length, 6);
    const breadth = Math.min(matchedSkills.length, 3) / 3;
    skill = Math.round(55 * Math.min(1, 0.7 * coverage + 0.3 * breadth));
  }
  if (matchedSkills.length) reasons.push(`Uses ${matchedSkills.slice(0, 3).join(", ")}`);

  // Title mentions one of your skills directly.
  const title = p.title.toLowerCase();
  const titleHit = declared.some((s) => s.length > 1 && title.includes(s.toLowerCase()));
  const title15 = titleHit ? 15 : matchedSkills.length ? 6 : 0;
  if (titleHit) reasons.push("Title matches your skills");

  // Remote / on-site preference.
  let place = 5;
  if (profile.remotePref === "remote") place = p.remote ? 10 : -12; // on-site when you asked for remote is a real mismatch
  else if (profile.remotePref === "onsite") place = p.remote ? 3 : 10;
  else place = 8;
  if (profile.remotePref === "remote" && p.remote) reasons.push("Remote");
  if (profile.remotePref === "remote" && !p.remote) cautions.push("Not remote");

  // Work type: freelance/contract vs full-time.
  const text = `${p.title} ${p.description.slice(0, 600)}`;
  const isLeadish = p.kind === "lead" || LEAD_HINT.test(text);
  const isFull = FULLTIME_HINT.test(text) && !isLeadish;
  const wantsLead = profile.workTypes.some((w) => ["freelance", "contract", "part-time", "brand-deals", "home-tuition", "online-tuition"].includes(w));
  const wantsFull = profile.workTypes.some((w) => ["full-time", "school-job"].includes(w));
  let type = 5;
  if (isLeadish) type = wantsLead ? 10 : 2;
  else if (isFull) type = wantsFull ? 10 : 2;
  else type = wantsLead || wantsFull ? 6 : 5;
  if (isLeadish && wantsLead) reasons.push("Freelance / contract");
  if (isLeadish && !wantsLead) cautions.push("Freelance / contract");
  if (isFull && !wantsFull) cautions.push("Full-time");

  // Freshness: full marks in the first 2 days, fading to 0 at 21 days.
  const ageDays = Math.max(0, (nowMs - Date.parse(p.postedAt)) / 86_400_000);
  const fresh = Math.round(10 * Math.max(0, Math.min(1, (21 - ageDays) / 19)));
  if (ageDays < 2) reasons.push("Posted recently");

  // Region: if the user named regions and the posting names a specific place they didn't, soften.
  let regionPenalty = 0;
  if (profile.regions.length && !p.remote) {
    const loc = p.location.toLowerCase();
    if (loc && !profile.regions.some((r) => loc.includes(r.toLowerCase()))) {
      regionPenalty = 8;
      cautions.push("Outside your regions");
    }
  }

  const raw = skill + title15 + place + type + fresh - regionPenalty;
  // No skills in common → never rank high, whatever else lines up.
  const score = Math.max(0, Math.min(100, matchedSkills.length ? raw : Math.min(raw, 35)));
  if (!matchedSkills.length) cautions.push("No shared skills");
  return { score, matchedSkills, reasons: reasons.slice(0, 4), cautions };
}
