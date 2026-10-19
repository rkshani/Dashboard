import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Sections";
import { ClientsView } from "@/components/app/views/ClientsView";
import { ProjectsView } from "@/components/app/views/ProjectsView";
import { TasksView } from "@/components/app/views/TasksView";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
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
    if (mod.id === "clients" || mod.id === "students") return <ClientsView template={template} clients={clients} projects={projects} />;
    if (mod.id === "tasks") return <TasksView template={template} tasks={tasks} projects={projects} today={today} />;
    const sp = await searchParams;
    const view = sp.view === "list" ? "list" : "board";
    return <ProjectsView template={template} projects={projects} clients={clients} tasks={tasks} today={today} currency={profile.currency} view={view} />;
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
