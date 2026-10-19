import type { NextRequest } from "next/server";

export function googleRedirectUri(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  return `${base}/api/integrations/google/callback`;
}
