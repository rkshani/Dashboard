"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { notify } from "@/lib/notifications/notify";
import { pushConfigured } from "@/lib/notifications/push";
import { rateLimit } from "@/lib/rate-limit";

export async function markAllRead() {
  const { repo } = await getRepo();
  await repo.markNotificationsRead();
  refresh();
}

/** Browser push subscriptions only ever point at real push services over HTTPS. */
const subSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://"), "Invalid endpoint"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean; message: string }> {
  if (!pushConfigured()) return { ok: false, message: "Push isn't set up on this server yet." };
  const parsed = subSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That browser subscription looks invalid." };
  const { repo, userId } = await getRepo();
  if (!(await rateLimit(`push-sub:${userId}`, 10, 3_600_000))) return { ok: false, message: "Too many attempts. Try again later." };
  try {
    await repo.savePushSubscription({ endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth });
  } catch {
    // Most likely this browser is still subscribed for another account.
    return { ok: false, message: "Couldn't save this device. If another account used push in this browser, turn it off there first." };
  }
  return { ok: true, message: "Push notifications are on for this device." };
}

export async function removePushSubscription(endpoint: string) {
  const ok = z.string().url().max(1000).safeParse(endpoint);
  if (!ok.success) return;
  const { repo } = await getRepo();
  await repo.deletePushSubscription(ok.data);
}

export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const { repo, userId } = await getRepo();
  if (!(await rateLimit(`push-test:${userId}`, 5, 3_600_000))) return { ok: false, message: "You've sent a few already. Try again later." };
  await notify(repo, { kind: "system", title: "Test notification", body: "If you can read this, notifications work.", href: "/app/notifications" });
  refresh();
  return { ok: true, message: "Sent. Check this page and your device." };
}
