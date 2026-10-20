/** A job or lead after normalisation: one shape no matter which source it came from. */
export type Posting = {
  /** Stable id: `${source}:${externalId}` */
  id: string;
  source: SourceId;
  externalId: string;
  /** Same role posted on several boards → same fingerprint (used to de-duplicate). */
  fingerprint: string;
  kind: "job" | "lead";
  title: string;
  company: string;
  url: string;
  location: string;
  remote: boolean;
  tags: string[];
  /** Plain text only — source HTML is stripped and never rendered. */
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string; // ISO
  /** Shown next to every posting; some sources require it. */
  attribution: { name: string; url: string };
};

export const SOURCE_IDS = ["remotive", "remoteok", "arbeitnow", "greenhouse", "lever", "demo"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export const PIPELINE_STATUSES = ["new", "saved", "contacted", "proposal", "won", "lost", "dismissed"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export type Match = {
  score: number; // 0–100
  matchedSkills: string[];
  reasons: string[];
  /** Things that count against it ("Not remote"), shown separately. */
  cautions: string[];
  /** Posted pay as yearly amounts in the user's currency (approximate), when the posting lists any. */
  pay: { min: number; max: number; currency: string } | null;
  /** How the posted pay compares with the user's minimum rate. */
  payFit: "meets" | "below" | "unknown";
};

export type FeedItem = Posting & Match & { status: PipelineStatus };
