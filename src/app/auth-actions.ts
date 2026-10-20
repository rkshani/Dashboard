"use server";

import { demoAllowed } from "@/lib/demo-mode";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { DEMO_COOKIE, DEMO_PROFILE_COOKIE, getCurrentUser } from "@/lib/auth";
import { profileFormSchema, profileToRow } from "@/lib/profile";
import { isTemplateId } from "@/templates";
import { rateLimit } from "@/lib/rate-limit";

export type FormState = { status: "idle" | "error" | "success"; message: string };

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

async function origin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

/** Only allow redirects back into our own app. */
function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export async function signInWithEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!supabaseConfigured()) return { status: "error", message: "Email sign-in needs Supabase. Use demo mode for now." };
  if (!(await rateLimit(`login:${await clientIp()}`, 5, 10 * 60_000))) {
    return { status: "error", message: "Too many attempts. Try again in a few minutes." };
  }
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Please enter a valid email." };

  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  // Same message either way, so the form can't be used to discover who has an account.
  if (error) console.error("[auth] otp error:", error.status);
  return { status: "success", message: "Check your inbox for a sign-in link." };
}

export async function signInWithGoogle(formData: FormData) {
  if (!supabaseConfigured()) redirect("/login?error=not-configured");
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function startDemo() {
  if (supabaseConfigured()) redirect("/login");
  if (!demoAllowed()) redirect("/login?error=not-configured");
  const jar = await cookies();
  if (!/^[0-9a-f-]{36}$/.test(jar.get(DEMO_COOKIE)?.value ?? "")) jar.set(DEMO_COOKIE, randomUUID(), cookieOpts);
  redirect(jar.get(DEMO_PROFILE_COOKIE) ? "/app" : "/onboarding");
}

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    const jar = await cookies();
    jar.delete(DEMO_COOKIE);
  }
  redirect("/login");
}

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = profileFormSchema.safeParse({
    displayName: formData.get("displayName"),
    templateId: formData.get("templateId"),
    skills: formData.get("skills") ?? "",
    workTypes: formData.getAll("workTypes").join(","),
    rateMin: formData.get("rateMin") ?? "",
    rateMax: formData.get("rateMax") ?? "",
    currency: formData.get("currency") || undefined,
    remotePref: formData.get("remotePref") || undefined,
    regions: formData.get("regions") ?? "",
    timezone: formData.get("timezone") || undefined,
    theme: formData.get("theme") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your answers." };
  if (!isTemplateId(parsed.data.templateId)) return { status: "error", message: "Please pick a field." };

  if (user.demo) {
    const jar = await cookies();
    jar.set(DEMO_PROFILE_COOKIE, Buffer.from(JSON.stringify(parsed.data)).toString("base64url"), cookieOpts);
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...profileToRow(parsed.data), onboarded_at: new Date().toISOString() });
    if (error) {
      console.error("[profile] save failed:", error.code);
      return { status: "error", message: "Couldn't save your profile. Please try again." };
    }
  }

  const dest = formData.get("returnTo") === "settings" ? "/app/settings?saved=1" : "/app";
  redirect(dest);
}
