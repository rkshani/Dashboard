import { createClient } from "@supabase/supabase-js";
import { cronAuthorized } from "@/lib/cron-auth";
import { composeDigest } from "@/lib/automations/compose";
import { ruleEnabled, runAutomations } from "@/lib/automations/engine";
import { SupabaseRepo } from "@/lib/data/supabase-repo";
import { todayIn } from "@/lib/dates";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rowToProfile, type ProfileRow } from "@/lib/profile";
import { getTemplate } from "@/templates";

/**
 * Hourly job: for every onboarded user, run their automation rules, and once it is at or past their
 * chosen hour in their own time zone (and today's digest hasn't gone out), email the daily digest.
 * "At or past" means a missed or late cron run still delivers today's digest.
 * Uses the service-role key, so every query goes through SupabaseRepo, which filters by owner.
 */
export const maxDuration = 300;

function localHour(timezone: string) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  } catch {
    return new Date().getUTCHours();
  }
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "Supabase service role not configured" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profiles, error } = await db.from("profiles").select("*").not("onboarded_at", "is", null).limit(5000);
  if (error) return Response.json({ error: "Could not load profiles" }, { status: 500 });

  const stats = { users: 0, actions: 0, digests: 0, failures: 0 };
  for (const row of (profiles ?? []) as ProfileRow[]) {
    stats.users++;
    try {
      const profile = rowToProfile(row);
      const template = getTemplate(profile.templateId);
      const repo = new SupabaseRepo(db, row.id); // owner-scoped
      const today = todayIn(profile.timezone);

      const done = await runAutomations({ repo, profile, template, today });
      stats.actions += done.length;

      const settings = await repo.getAutomationSettings();
      const due = ruleEnabled(template, settings, "morning-digest") && localHour(profile.timezone) >= settings.digestHour && settings.lastDigestOn !== today;
      if (due && emailConfigured()) {
        const { data: u } = await db.auth.admin.getUserById(row.id);
        const email = u.user?.email;
        if (email) {
          // Mark first so a retry or overlapping run can't send twice.
          await repo.saveAutomationSettings({ lastDigestOn: today });
          const { digest, html, text } = await composeDigest({ repo, profile, template, today, ownerId: row.id });
          await sendEmail({ to: email, subject: digest.subject, html, text });
          stats.digests++;
        }
      }
    } catch (e) {
      stats.failures++;
      console.error("[automations] user run failed:", e instanceof Error ? e.message : e);
    }
  }
  return Response.json(stats);
}
