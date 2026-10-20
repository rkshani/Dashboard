import { createClient } from "@supabase/supabase-js";
import { cronAuthorized } from "@/lib/cron-auth";
import { composeDigest } from "@/lib/automations/compose";
import { ruleEnabled, runAutomations } from "@/lib/automations/engine";
import { SupabaseRepo } from "@/lib/data/supabase-repo";
import { todayIn } from "@/lib/dates";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rowToProfile, type ProfileRow } from "@/lib/profile";
import { getTemplate } from "@/templates";
import { recordJobRun } from "@/lib/jobs";
import { getRates } from "@/lib/fx";
import { materializeRecurring } from "@/lib/recurring";
import { materializeRecurringInvoices } from "@/lib/recurring-invoices";

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

  // Load the shared posting pool and exchange rates once for every user in this run.
  const [postings, fx] = await Promise.all([new SupabaseRepo(db, "00000000-0000-0000-0000-000000000000").listPostings(), getRates()]);
  const feed = { postings, fx };

  const stats = { users: 0, actions: 0, digests: 0, failures: 0 };
  for (const row of (profiles ?? []) as ProfileRow[]) {
    stats.users++;
    try {
      const profile = rowToProfile(row);
      const template = getTemplate(profile.templateId);
      const repo = new SupabaseRepo(db, row.id); // owner-scoped
      const today = todayIn(profile.timezone);

      let ownerEmail: string | null | undefined;
      const getOwnerEmail = async () => (ownerEmail ??= (await db.auth.admin.getUserById(row.id)).data.user?.email ?? null);
      await materializeRecurring(repo, today);
      await materializeRecurringInvoices(repo, today, { emailClients: true, senderName: profile.displayName, ownerEmail: getOwnerEmail });
      const done = await runAutomations({ repo, profile, template, today, feed, emailClients: true, ownerEmail: getOwnerEmail });
      stats.actions += done.length;

      const settings = await repo.getAutomationSettings();
      const due = ruleEnabled(template, settings, "morning-digest") && localHour(profile.timezone) >= settings.digestHour && settings.lastDigestOn !== today;
      if (due && emailConfigured()) {
        const email = await getOwnerEmail();
        if (email) {
          // Mark first so a retry or overlapping run can't send twice.
          await repo.saveAutomationSettings({ lastDigestOn: today });
          const { digest, html, text } = await composeDigest({ repo, profile, template, today, ownerId: row.id, feed });
          await sendEmail({ to: email, subject: digest.subject, html, text });
          stats.digests++;
        }
      }
    } catch (e) {
      stats.failures++;
      console.error("[automations] user run failed:", e instanceof Error ? e.message : e);
    }
  }
  // Housekeeping: notifications older than 90 days.
  await db.from("notifications").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  await recordJobRun(db, "automations", {
    ok: stats.failures === 0 || stats.failures < stats.users,
    error: stats.failures ? `${stats.failures} of ${stats.users} users failed` : undefined,
    details: stats,
  });
  return Response.json(stats);
}
