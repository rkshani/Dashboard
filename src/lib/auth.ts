import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "./supabase/server";
import { storedProfileSchema, rowToProfile, type Profile, type ProfileRow } from "./profile";

/**
 * Data Access Layer: the only place that reads the session and the profile.
 * Every page and action goes through these functions.
 */

export type SessionUser = { id: string; email: string; demo: boolean };

export const DEMO_COOKIE = "dash_demo";
export const DEMO_PROFILE_COOKIE = "dash_demo_profile";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!supabaseConfigured()) {
    const jar = await cookies();
    const id = jar.get(DEMO_COOKIE)?.value;
    // The demo cookie holds a random session id that keys the in-memory demo store.
    return id && /^[0-9a-f-]{36}$/.test(id) ? { id, email: "demo@local", demo: true } : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(); // verified with the auth server
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "", demo: false };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.demo) {
    const raw = (await cookies()).get(DEMO_PROFILE_COOKIE)?.value;
    if (!raw) return null;
    try {
      const parsed = storedProfileSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<ProfileRow>();
  if (!data || !data.onboarded_at) return null;
  return rowToProfile(data);
});

/** For app pages: signed in AND onboarded, otherwise send them where they belong. */
export async function requireProfile(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return { user, profile };
}
