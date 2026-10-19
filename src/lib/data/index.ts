import "server-only";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { DemoRepo } from "./demo-repo";
import { SupabaseRepo } from "./supabase-repo";
import type { Repo } from "./repo";

/** The signed-in user's storage, plus their "today" (in their own time zone). */
export async function getRepo(): Promise<{ repo: Repo; today: string; timezone: string }> {
  const { user, profile } = await requireProfile();
  const today = todayIn(profile.timezone);
  const repo = user.demo ? new DemoRepo(user.id, today) : new SupabaseRepo(await createSupabaseServerClient());
  return { repo, today, timezone: profile.timezone };
}

export type { Repo } from "./repo";
