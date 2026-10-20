"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { roles } from "@/lib/site";

export type WaitlistState = {
  status: "idle" | "success" | "error";
  message: string;
};

const roleSlugs = new Set([...roles.map((r) => r.slug), "other"]);

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(254),
  role: z
    .string()
    .default("software-engineers")
    .refine((v) => roleSlugs.has(v), "Please pick a field from the list."),
  source: z.string().trim().max(64).optional(),
});

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // Honeypot: real people never fill this hidden field.
  if (formData.get("company_website")) {
    return { status: "success", message: "You're on the list. We'll be in touch soon." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`waitlist:${ip}`))) {
    return { status: "error", message: "Too many attempts. Please try again in a minute." };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || undefined,
    source: formData.get("source") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.warn("[waitlist] Supabase not configured; signup not stored:", parsed.data.role);
    return { status: "success", message: "You're on the list (dev mode: not saved, Supabase isn't configured)." };
  }

  const { error } = await supabase.from("waitlist").insert({
    email: parsed.data.email,
    role: parsed.data.role,
    source: parsed.data.source ?? null,
  });

  // 23505 = unique violation: already signed up. Treat as success, don't reveal it.
  if (error && error.code !== "23505") {
    console.error("[waitlist] insert failed:", error.code);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success", message: "You're on the list. We'll be in touch soon." };
}
