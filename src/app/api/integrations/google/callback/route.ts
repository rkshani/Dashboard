import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { SupabaseRepo } from "@/lib/data/supabase-repo";
import { exchangeCode } from "@/lib/google/calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googleRedirectUri } from "@/lib/google/redirect";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/app/calendar?${q}`, req.url));
  const jar = await cookies();
  const expected = jar.get("g_oauth_state")?.value ?? "";
  jar.delete({ name: "g_oauth_state", path: "/api/integrations/google" });

  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back("error=denied");
  const state = p.get("state") ?? "";
  const code = p.get("code") ?? "";
  if (!expected || !state || !same(state, expected) || !code) return back("error=state");

  const user = await getCurrentUser();
  if (!user || user.demo) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const t = await exchangeCode(code, googleRedirectUri(req));
    if (!t.refreshToken) return back("error=no-refresh-token");
    if (!t.scope.includes("calendar.events")) return back("error=scope");
    const repo = new SupabaseRepo(await createSupabaseServerClient(), user.id);
    await repo.saveIntegration({ provider: "google", refreshTokenEnc: encrypt(t.refreshToken, user.id), accountEmail: t.email, scope: t.scope });
    return back("connected=1");
  } catch (e) {
    console.error("[google] connect failed:", e instanceof Error ? e.message : e);
    return back("error=exchange");
  }
}
