import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the Supabase session fresh and does a fast, optimistic gate on app routes.
 * The real authorization check happens again on the server (src/lib/auth.ts) and in
 * the database (row-level security). This is only a first line.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtected = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/onboarding");

  // Demo mode (no Supabase configured): allow if a demo session cookie exists.
  if (!url || !key) {
    if (isProtected && !request.cookies.get("dash_demo")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Validates the JWT (do not replace with getSession(), which trusts the cookie).
  const { data } = await supabase.auth.getClaims();

  if (isProtected && !data?.claims) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login", "/auth/:path*"],
};
