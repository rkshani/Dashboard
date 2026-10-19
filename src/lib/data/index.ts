import "server-only";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayIn, tzOffsetMinutes } from "@/lib/dates";
import { DemoRepo } from "./demo-repo";
import { SupabaseRepo } from "./supabase-repo";
import type { Repo } from "./repo";

/** The signed-in user's storage, plus their "today" (in their own time zone). */
export async function getRepo(): Promise<{ repo: Repo; today: string; timezone: string; currency: string; userId: string; demo: boolean }> {
  const { user, profile } = await requireProfile();
  const today = todayIn(profile.timezone);
  const repo = user.demo ? new DemoRepo(user.id, today, profile.currency, tzOffsetMinutes(profile.timezone)) : new SupabaseRepo(await createSupabaseServerClient(), user.id);
  return { repo, today, timezone: profile.timezone, currency: profile.currency, userId: user.id, demo: user.demo };
}

export type { Repo } from "./repo";
