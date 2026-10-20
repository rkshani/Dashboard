import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Sections";
import { ClientsView } from "@/components/app/views/ClientsView";
import { ProjectsView } from "@/components/app/views/ProjectsView";
import { TasksView } from "@/components/app/views/TasksView";
import { FinanceView } from "@/components/app/views/FinanceView";
import { InvoicesView } from "@/components/app/views/InvoicesView";
import { monthKey } from "@/lib/money";
import { addDays } from "@/lib/dates";
import { OpportunitiesView } from "@/components/app/views/OpportunitiesView";
import { getFeed } from "@/lib/opportunities/feed";
import { CalendarView } from "@/components/app/views/CalendarView";
import { AutomationsView } from "@/components/app/views/AutomationsView";
import { emailConfigured } from "@/lib/email";
import { getCalendar, localRange } from "@/lib/calendar";
import type { CalEvent } from "@/lib/calendar/types";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { materializeRecurring } from "@/lib/recurring";
import { getRates } from "@/lib/fx";
import { feeRows } from "@/lib/teaching/fees";
import { FeesPanel } from "@/components/app/views/FeesPanel";
import { TimetableView } from "@/components/app/views/TimetableView";
import { ContentView } from "@/components/app/views/ContentView";
import { getTemplate } from "@/templates";

/** What each module will do once built — shown so the shell is honest about progress. */
const roadmap: Record<string, string[]> = {
  opportunities: ["Feed of matched postings with scores", "Save, dismiss, mark applied", "Pipeline: New → Contacted → Proposal → Won/Lost", "AI-drafted proposals you approve"],
  projects: ["List and Kanban views", "Deadlines, status and progress", "Linked client, tasks and invoices"],
  clients: ["Contacts, notes and history", "Linked projects", "Total billed and paid"],
  tasks: ["Today, upcoming and overdue", "Priority and due dates", "Link to projects and clients"],
  calendar: ["Google Calendar sync", "Create events from tasks", "Deadlines on the same view"],
  finance: ["Income and expenses with categories", "Monthly summary", "Per-client profitability"],
  invoices: ["Create from a project", "Paid / unpaid tracking", "PDF download and reminders"],
  students: ["Students and guardians", "Attendance and progress", "Fee status per student"],
  timetable: ["Weekly class timetable", "Class plans", "Calendar sync"],
  content: ["Content calendar across channels", "Drafts, approvals and schedule", "Linked campaigns"],
  automations: ["Turn built-in rules on or off", "See what ran and when", "Your own When / Then rules"],
};

export default function ModulePage({ params, searchParams }: PageProps<"/app/[module]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-surface" />}>
      <ModuleBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ModuleBody({ params, searchParams }: Pick<PageProps<"/app/[module]">, "params" | "searchParams">) {
  const { module: moduleId } = await params;
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const mod = template.modules.find((m) => m.id === moduleId);
  if (!mod) notFound();

  // Modules with real data. Teachers' "Students" share the clients store; "Classes"/"Campaigns" share projects.
  if (mod.id === "clients" || mod.id === "students" || mod.id === "projects" || mod.id === "tasks") {
    const { repo, today } = await getRepo();
    const [clients, projects, tasks] = await Promise.all([repo.listClients(), repo.listProjects(), repo.listTasks()]);
    if (mod.id === "clients" || mod.id === "students") {
      const teaching = mod.id === "students" ? { classes: projects.filter((p) => p.status !== "done").map((p) => ({ id: p.id, title: p.title })), currency: profile.currency } : undefined;
      return <ClientsView template={template} clients={clients} projects={projects} teaching={teaching} />;
    }
    if (mod.id === "tasks") return <TasksView template={template} tasks={tasks} projects={projects} today={today} />;
    const sp = await searchParams;
    const view = sp.view === "list" ? "list" : "board";
    return <ProjectsView template={template} projects={projects} clients={clients} tasks={tasks} today={today} currency={profile.currency} view={view} />;
  }

  if (mod.id === "automations") {
    const { repo, timezone, userId, demo } = await getRepo();
    const [settings, log, cal] = await Promise.all([repo.getAutomationSettings(), repo.listAutomationLog(30), getCalendar(repo, userId, timezone)]);
    return (
      <AutomationsView
        template={template}
        settings={settings}
        log={log}
        timezone={timezone}
        demo={demo}
        emailReady={emailConfigured()}
        calendarConnected={cal.state.mode === "google" || cal.state.mode === "demo"}
      />
    );
  }

  if (mod.id === "timetable") {
    const { repo, today } = await getRepo();
    const [slots, classes, clients, marks] = await Promise.all([repo.listSlots(), repo.listProjects(), repo.listClients(), repo.listAttendance(today, today)]);
    const studentCount: Record<string, number> = {};
    for (const c of clients) if (c.classId && c.status === "active") studentCount[c.classId] = (studentCount[c.classId] ?? 0) + 1;
    return <TimetableView template={template} title={mod.label} slots={slots} classes={classes} today={today} studentCount={studentCount} markedToday={new Set(marks.map((m) => m.classId).filter((x): x is string => !!x))} />;
  }

  if (mod.id === "content") {
    const { repo, today } = await getRepo();
    const [posts, campaigns, clients, sp] = await Promise.all([repo.listContent(), repo.listProjects(), repo.listClients(), searchParams]);
    const current = today.slice(0, 7);
    const month = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : current;
    return <ContentView template={template} title={mod.label} posts={posts} campaigns={campaigns} clients={clients} today={today} month={month} />;
  }

  if (mod.id === "calendar") {
    const { repo, today, timezone, userId } = await getRepo();
    const [cal, tasks, projects, sp] = await Promise.all([getCalendar(repo, userId, timezone), repo.listTasks(), repo.listProjects(), searchParams]);
    let events: CalEvent[] = [];
    let loadError = false;
    if (cal.state.mode === "google" || cal.state.mode === "demo") {
      const { from, to } = localRange(today, 14, timezone);
      try {
        events = await cal.list(from, to);
      } catch {
        loadError = cal.state.mode === "google";
      }
    }
    return (
      <CalendarView
        title={mod.label}
        state={cal.state}
        events={events}
        loadError={loadError}
        tasks={tasks}
        projects={projects}
        today={today}
        timezone={timezone}
        notice={sp.connected === "1" ? "Google Calendar connected." : undefined}
        error={typeof sp.error === "string" ? sp.error : undefined}
      />
    );
  }

  if (mod.id === "opportunities") {
    const { repo } = await getRepo();
    const { user } = await requireProfile();
    const [items, sp] = await Promise.all([getFeed(repo, profile), searchParams]);
    const tab = sp.tab === "pipeline" || sp.tab === "dismissed" ? sp.tab : "feed";
    const minRaw = Number(sp.min);
    const min = [0, 40, 60, 80].includes(minRaw) ? minRaw : 40;
    const kind = sp.kind === "job" || sp.kind === "lead" ? sp.kind : "all";
    const live = user.demo ? process.env.DEMO_LIVE_FEED === "1" : true;
    const isDemoFeed = user.demo && (!live || items.every((i) => i.source === "demo"));
    return <OpportunitiesView template={template} items={items} tab={tab} min={min} kind={kind} remoteOnly={sp.remote === "1"} hideLowPay={sp.pay === "1"} hasRate={!!profile.rateMin && template.onboarding.rateUnit !== "project"} demo={isDemoFeed} liveConfigured={!user.demo} />;
  }

  if (mod.id === "finance" || mod.id === "invoices") {
    const { repo, today, currency } = await getRepo();
    if (mod.id === "finance") await materializeRecurring(repo, today);
    const [clients, projects, transactions, invoices, recurring] = await Promise.all([repo.listClients(), repo.listProjects(), repo.listTransactions(), repo.listInvoices(), repo.listRecurring()]);
    if (mod.id === "invoices") {
      const business = await repo.getBusinessProfile();
      return <InvoicesView template={template} fx={await getRates()} invoices={invoices} clients={clients} projects={projects} today={today} currency={currency} defaultDueDate={business.defaultDueDays ? addDays(today, business.defaultDueDays) : today} />;
    }
    const sp = await searchParams;
    const current = monthKey(today);
    const m = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= current ? sp.m : current;
    return (
      <FinanceView template={template} recurring={recurring} fx={await getRates()} transactions={transactions} invoices={invoices} clients={clients} today={today} currency={currency} month={m} title={mod.label}>
        {template.modules.some((x) => x.id === "students") && <FeesPanel rows={feeRows(clients, transactions, m, today)} month={m} currency={currency} senderName={profile.displayName} studentsHref="/app/students" />}
      </FinanceView>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="anim-rise flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-accent">
          <Icon name={mod.icon} />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{mod.label}</h1>
          <p className="text-sm text-muted">{mod.description}</p>
        </div>
      </header>

      <section className="anim-rise mt-8 rounded-2xl border border-dashed border-line bg-surface p-8 text-center" style={{ animationDelay: "80ms" }}>
        <p className="font-display text-xl font-semibold">Coming in the next build step</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">The shell, template and navigation are live. This module gets its data and screens next.</p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
          {(roadmap[mod.id] ?? []).map((r) => (
            <li key={r} className="flex items-center gap-3">
              <Icon name="check" className="shrink-0 text-muted" />
              {r}
            </li>
          ))}
        </ul>
        <Link href="/app" className="lift mt-8 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
          Back to home
        </Link>
      </section>
    </div>
  );
}
