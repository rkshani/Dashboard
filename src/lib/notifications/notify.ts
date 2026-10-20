import "server-only";
import type { Repo } from "@/lib/data/repo";
import { sendPush } from "./push";
import type { NewNotification } from "./types";

/** Adds an in-app notification and pushes it to the user's devices (if they turned push on). */
export async function notify(repo: Repo, n: NewNotification) {
  const safe: NewNotification = { ...n, title: n.title.slice(0, 160), body: n.body?.slice(0, 500) ?? null, href: n.href && n.href.startsWith("/app") ? n.href : null };
  await repo.addNotification(safe);
  try {
    const subs = await repo.listPushSubscriptions();
    const gone = await sendPush(subs, { title: safe.title, body: safe.body ?? undefined, url: safe.href ?? "/app/notifications", tag: safe.kind });
    for (const e of gone) await repo.deletePushSubscription(e);
  } catch (e) {
    console.warn("[notify] push skipped:", e instanceof Error ? e.message : e);
  }
}
