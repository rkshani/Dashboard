import { Suspense } from "react";
import { WidgetGrid } from "@/components/widgets/Widgets";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { getRates } from "@/lib/fx";
import { toCurrency } from "@/lib/fx-math";
import { materializeRecurring } from "@/lib/recurring";
import { getFeed } from "@/lib/opportunities/feed";
import { getCalendar, localRange } from "@/lib/calendar";
import type { CalEvent } from "@/lib/calendar/types";
import { getTemplate } from "@/templates";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  );
}

function greeting(timezone: string) {
  let hour = new Date().getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  } catch {
    /* unknown zone: fall back to UTC */
  }
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

async function Home() {
  const { user, profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const { repo, today: todayIso, userId, timezone } = await getRepo();
  await materializeRecurring(repo, todayIso);
  const [clients, projects, tasks, rawTransactions, rawInvoices, feed, automationLog, fx] = await Promise.all([repo.listClients(), repo.listProjects(), repo.listTasks(), repo.listTransactions(), repo.listInvoices(), getFeed(repo, profile), repo.listAutomationLog(4), getRates()]);
  const needs = new Set(template.widgets.map((w) => w.type));
  const [slots, content] = await Promise.all([needs.has("timetable") ? repo.listSlots() : [], needs.has("content-calendar") ? repo.listContent() : []]);
  // Widgets show totals in the profile currency, so convert everything up front.
  const transactions = toCurrency(rawTransactions, "amount", profile.currency, fx);
  const invoices = toCurrency(rawInvoices, "total", profile.currency, fx);
  const demoFeed = user.demo && feed.every((o) => o.source === "demo");
  let events: CalEvent[] = [];
  const cal = await getCalendar(repo, userId, timezone);
  if (cal.state.mode === "google" || cal.state.mode === "demo") {
    const { from, to } = localRange(todayIso, 1, timezone);
    events = await cal.list(from, to).catch(() => []);
  }
  let today = "";
  try {
    today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: profile.timezone }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="anim-rise mb-6">
        <p className="text-sm text-muted">{today}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          {greeting(profile.timezone)}, {profile.displayName}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Widgets marked <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">Sample</span> show example data until that module is connected.
        </p>
      </header>
      <WidgetGrid template={template} profile={profile} data={{ clients, projects, tasks, transactions, invoices, feed, demoFeed, events, calendarMode: cal.state.mode, timezone, automationLog, today: todayIso, slots, content }} />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl" aria-busy="true" aria-label="Loading your dashboard">
      <div className="mb-6 h-16 w-72 animate-pulse rounded-xl bg-surface" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
