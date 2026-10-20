import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { markAllRead } from "@/app/app/notification-actions";
import { MiniAction } from "@/components/app/forms";
import { PushToggle } from "@/components/app/PushToggle";
import { Icon } from "@/components/Sections";
import { getRepo } from "@/lib/data";
import { pushConfigured } from "@/lib/notifications/push";
import type { NotificationKind } from "@/lib/notifications/types";

export const metadata: Metadata = { title: "Notifications" };

const kindIcon: Record<NotificationKind, string> = { match: "radar", deadline: "calendar", invoice: "file", money: "wallet", task: "check", system: "bell" };

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="anim-rise">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted">What your automations did, and anything that needs you.</p>
      </header>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const { repo, timezone } = await getRepo();
  const items = await repo.listNotifications(100);
  const unread = items.filter((n) => !n.readAt).length;
  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
    } catch {
      return when(iso);
    }
  };
  return (
    <>
      <section aria-label="Push notifications" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">On your phone or computer</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Get the same alerts as push notifications, even when the app is closed.</p>
        <PushToggle configured={pushConfigured()} />
      </section>

      <section aria-label="All notifications" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{unread ? `${unread} unread` : "All caught up"}</h2>
          {unread > 0 && (
            <MiniAction action={markAllRead} fields={{}} className="h-9 cursor-pointer rounded-lg border border-line px-3 text-xs font-medium hover:border-accent">
              Mark all as read
            </MiniAction>
          )}
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">
            Nothing yet. Notifications appear when an automation acts for you, for example a strong new match or an overdue invoice.{" "}
            <Link href="/app/automations" className="text-accent underline">
              See automations
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const inner = (
                <>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.readAt ? "bg-surface-2 text-muted" : "bg-accent/15 text-accent"}`}>
                    <Icon name={kindIcon[n.kind] ?? "bell"} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.title}</span>
                    {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted">{fmt(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="-mx-2 flex gap-3 rounded-xl px-2 py-3 hover:bg-surface-2">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex gap-3 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
