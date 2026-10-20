import { z } from "zod";
import { reportError } from "@/lib/monitoring";
import { rateLimit } from "@/lib/rate-limit";

/** Errors caught by the app's error screen in the browser. Small, rate-limited, no user content. */
const body = z.object({
  message: z.string().max(300),
  digest: z.string().max(100).optional(),
  path: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!rateLimit(`client-error:${ip}`, 10, 60_000)) return new Response(null, { status: 429 });
  const raw = await req.text();
  if (raw.length > 2000) return new Response(null, { status: 413 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });
  await reportError({ source: "client", ...parsed.data });
  return new Response(null, { status: 204 });
}
