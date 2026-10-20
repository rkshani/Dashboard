import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportError } from "./monitoring";

export const JOBS = {
  collect: { maxAgeHours: Number(process.env.COLLECT_MAX_AGE_HOURS ?? 13) }, // runs every 6h
  automations: { maxAgeHours: Number(process.env.AUTOMATIONS_MAX_AGE_HOURS ?? 2) }, // runs hourly
} as const;
export type JobName = keyof typeof JOBS;

/** Heartbeat after each scheduled run; failures are also reported as alerts. */
export async function recordJobRun(db: SupabaseClient, job: JobName, result: { ok: boolean; error?: string; details?: Record<string, unknown> }) {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { job, last_run_at: now, details: result.details ?? {}, last_error: result.ok ? null : (result.error ?? "failed").slice(0, 500) };
  if (result.ok) row.last_ok_at = now;
  const { error } = await db.from("job_runs").upsert(row, { onConflict: "job" });
  if (error) console.error("[jobs] heartbeat failed:", error.code);
  if (!result.ok) await reportError({ source: `job:${job}`, message: result.error ?? "Job failed" });
}
