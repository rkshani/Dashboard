import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { encryptionConfigured } from "@/lib/crypto";
import { authUrl, googleConfigured } from "@/lib/google/calendar";
import { googleRedirectUri } from "@/lib/google/redirect";

/** Starts "Connect Google Calendar". A random state in an httpOnly cookie protects against CSRF. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (user.demo || !googleConfigured() || !encryptionConfigured()) {
    return NextResponse.redirect(new URL("/app/calendar?error=not-configured", req.url));
  }
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google",
    maxAge: 600,
  });
  return NextResponse.redirect(authUrl(state, googleRedirectUri(req)));
}
