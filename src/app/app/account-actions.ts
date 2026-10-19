"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { DEMO_COOKIE, DEMO_PROFILE_COOKIE, requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { getRepo } from "@/lib/data";
import { DemoRepo } from "@/lib/data/demo-repo";
import type { FormState } from "@/lib/data/types";
import { revoke } from "@/lib/google/calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Permanently deletes the account. Every table references auth.users with ON DELETE CASCADE,
 * so removing the auth user removes all of their data. The Google token is revoked first.
 */
export async function deleteAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { status: "error", message: 'Type DELETE to confirm.', at: Date.now() };
  }
  const { repo, userId } = await getRepo().catch(() => ({ repo: null, userId: user.id }));

  if (user.demo) {
    if (repo instanceof DemoRepo) repo.destroy();
    const jar = await cookies();
    jar.delete(DEMO_COOKIE);
    jar.delete(DEMO_PROFILE_COOKIE);
    redirect("/?deleted=1");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { status: "error", message: "Account deletion isn't configured on this server yet. Contact support.", at: Date.now() };

  if (repo) {
    const google = await repo.getIntegration("google").catch(() => null);
    if (google) {
      try {
        await revoke(decrypt(google.refreshTokenEnc, userId));
      } catch {
        /* already revoked or unreadable */
      }
    }
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed:", error.message);
    return { status: "error", message: "Couldn't delete the account. Please try again.", at: Date.now() };
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?deleted=1");
}
