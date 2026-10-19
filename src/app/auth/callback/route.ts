import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";

/** Finishes Google and email-link sign-in by swapping the one-time code for a session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/app") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code && supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
