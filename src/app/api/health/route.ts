import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { JOBS, type JobName } from "@/lib/jobs";

/**
 * For uptime monitors (UptimeRobot, Better Stack, etc.): 200 when healthy, 503 when the database
 * is unreachable or a scheduled job hasn't succeeded recently. Returns only statuses, no data.
 */
export async function GET() {
  await connection(); // always run at request time, never cached at build
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { "Cache-Control": "no-store" };
  if (!url || !key) return Response.json({ status: "ok", mode: "demo" }, { headers });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("job_runs").select("job,last_ok_at,last_run_at");
  if (error) return Response.json({ status: "down", database: "unreachable" }, { status: 503, headers });

  const now = Date.now();
  const jobs = Object.fromEntries(
    (Object.keys(JOBS) as JobName[]).map((name) => {
      const row = data?.find((r) => r.job === name);
      const lastOk = row?.last_ok_at ? Date.parse(row.last_ok_at as string) : null;
      const ageHours = lastOk ? (now - lastOk) / 3_600_000 : null;
      const healthy = ageHours !== null && ageHours <= JOBS[name].maxAgeHours;
      return [name, { healthy, lastSuccess: row?.last_ok_at ?? null }];
    }),
  );
  const allHealthy = Object.values(jobs).every((j) => j.healthy);
  return Response.json({ status: allHealthy ? "ok" : "degraded", database: "ok", jobs }, { status: allHealthy ? 200 : 503, headers });
}
