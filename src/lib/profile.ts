import { z } from "zod";

export const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED", "INR"] as const;
export const REMOTE_PREFS = [
  { id: "remote", label: "Remote only" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
  { id: "any", label: "Any" },
] as const;
export const THEME_IDS = ["midnight", "daylight", "forest", "dusk"] as const;

const csvList = (max: number, itemMax = 40) =>
  z
    .string()
    .default("")
    .transform((s) =>
      Array.from(
        new Set(
          s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => x.slice(0, itemMax)),
        ),
      ).slice(0, max),
    );

const money = z
  .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (v === "" ? null : v));

/** What onboarding collects. Parsed on the server; never trust the client. */
export const profileFormSchema = z
  .object({
    displayName: z.string().trim().min(1, "Tell us what to call you.").max(60),
    templateId: z.string().min(1),
    skills: csvList(25),
    workTypes: csvList(6, 30),
    rateMin: money,
    rateMax: money,
    currency: z.enum(CURRENCIES).default("USD"),
    remotePref: z.enum(["remote", "hybrid", "onsite", "any"]).default("remote"),
    regions: csvList(10),
    timezone: z.string().trim().max(64).default("UTC"),
    theme: z.enum(THEME_IDS).default("midnight"),
  })
  .refine((p) => p.rateMin === null || p.rateMax === null || p.rateMin <= p.rateMax, {
    message: "Minimum rate can't be higher than the maximum.",
    path: ["rateMax"],
  });

export type Profile = z.output<typeof profileFormSchema>;

/** Database row (snake_case) ↔ app shape (camelCase). */
export type ProfileRow = {
  id: string;
  display_name: string;
  template_id: string;
  skills: string[];
  work_types: string[];
  rate_min: number | null;
  rate_max: number | null;
  currency: string;
  remote_pref: string;
  regions: string[];
  timezone: string;
  theme: string;
  onboarded_at: string | null;
};

export function rowToProfile(r: ProfileRow): Profile {
  return {
    displayName: r.display_name,
    templateId: r.template_id,
    skills: r.skills ?? [],
    workTypes: r.work_types ?? [],
    rateMin: r.rate_min,
    rateMax: r.rate_max,
    currency: (CURRENCIES as readonly string[]).includes(r.currency) ? (r.currency as Profile["currency"]) : "USD",
    remotePref: (["remote", "hybrid", "onsite", "any"].includes(r.remote_pref) ? r.remote_pref : "any") as Profile["remotePref"],
    regions: r.regions ?? [],
    timezone: r.timezone || "UTC",
    theme: ((THEME_IDS as readonly string[]).includes(r.theme) ? r.theme : "midnight") as Profile["theme"],
  };
}

export function profileToRow(p: Profile) {
  return {
    display_name: p.displayName,
    template_id: p.templateId,
    skills: p.skills,
    work_types: p.workTypes,
    rate_min: p.rateMin,
    rate_max: p.rateMax,
    currency: p.currency,
    remote_pref: p.remotePref,
    regions: p.regions,
    timezone: p.timezone,
    theme: p.theme,
  };
}

/** Shape of an already-parsed profile (used to re-validate the demo cookie). */
export const storedProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  templateId: z.string().min(1),
  skills: z.array(z.string().max(40)).max(25),
  workTypes: z.array(z.string().max(30)).max(6),
  rateMin: z.number().nullable(),
  rateMax: z.number().nullable(),
  currency: z.enum(CURRENCIES),
  remotePref: z.enum(["remote", "hybrid", "onsite", "any"]),
  regions: z.array(z.string().max(40)).max(10),
  timezone: z.string().max(64),
  theme: z.enum(THEME_IDS),
});
