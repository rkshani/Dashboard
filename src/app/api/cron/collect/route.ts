import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { collectAll } from "@/lib/opportunities/sources";

/**
 * Scheduled collector. Vercel Cron calls it every 6 hours (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. It writes with the service-role key, which
 * exists only on the server and is never sent to the browser.
 */
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "Supabase service role not configured" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { postings, report } = await collectAll();

  const rows = postings.map((p) => ({
    id: p.id,
    source: p.source,
    fingerprint: p.fingerprint,
    kind: p.kind,
    title: p.title,
    company: p.company,
    url: p.url,
    location: p.location,
    remote: p.remote,
    tags: p.tags,
    description: p.description,
    salary_min: p.salaryMin,
    salary_max: p.salaryMax,
    salary_currency: p.salaryCurrency,
    posted_at: p.postedAt,
    attribution_name: p.attribution.name,
    fetched_at: new Date().toISOString(),
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await db.from("opportunities").upsert(chunk, { onConflict: "id" });
    if (error) console.error("[collect] upsert failed:", error.code, error.message);
    else upserted += chunk.length;
  }

  // Retention: drop postings older than 45 days that nobody has saved or acted on.
  const cutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data: old } = await db.from("opportunities").select("id").lt("posted_at", cutoff).limit(2000);
  let removed = 0;
  if (old?.length) {
    const ids = old.map((o) => o.id as string);
    const { data: kept } = await db.from("user_opportunities").select("opportunity_id").in("opportunity_id", ids).neq("status", "dismissed");
    const keep = new Set((kept ?? []).map((k) => k.opportunity_id as string));
    const drop = ids.filter((id) => !keep.has(id));
    if (drop.length) {
      const { error } = await db.from("opportunities").delete().in("id", drop);
      if (!error) removed = drop.length;
    }
  }

  return Response.json({ upserted, removed, sources: report });
}
