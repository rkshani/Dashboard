import "server-only";
import webpush from "web-push";
import type { PushSubscriptionRecord } from "./types";

/**
 * Web push with VAPID keys (no third-party service). Generate keys once with
 *   npx web-push generate-vapid-keys
 * and set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto: address).
 */
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function setup() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.CONTACT_EMAIL || "hello@example.com"}`;
  webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/** Sends to every device. Returns endpoints the push service says are gone, so callers can delete them. */
export async function sendPush(subs: PushSubscriptionRecord[], payload: PushPayload): Promise<string[]> {
  if (!pushConfigured() || !subs.length) return [];
  setup();
  const body = JSON.stringify({ ...payload, title: payload.title.slice(0, 120), body: payload.body?.slice(0, 240) });
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12, timeout: 5000 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
        else console.warn("[push] send failed:", code ?? (e instanceof Error ? e.message : e));
      }
    }),
  );
  return gone;
}
