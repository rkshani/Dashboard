import Link from "next/link";
import { deleteProject, moveProject, saveProject } from "@/app/app/work-actions";
import { ActionForm, MiniAction, StatusSelect } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { Icon } from "@/components/Sections";
import { daysBetween, relativeDay } from "@/lib/dates";
import { PROJECT_STATUSES, type Client, type Project, type ProjectStatus, type Task } from "@/lib/data/types";
import type { Template } from "@/templates";

const statusLabel: Record<ProjectStatus, string> = { planning: "Planning", active: "In progress", review: "In review", done: "Done" };
const statusDot: Record<ProjectStatus, string> = { planning: "bg-muted", active: "bg-accent", review: "bg-warn", done: "bg-good" };
const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: statusLabel[s] }));

function ProjectFields({ project, clients, v, currency }: { project?: Project; clients: Client[]; v: Template["vocabulary"]; currency: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {project && <input type="hidden" name="id" value={project.id} />}
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={labelCls}>Title *</span>
        <input name="title" required maxLength={160} defaultValue={project?.title} className={inputCls} placeholder={`${v.project} name`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{v.client}</span>
        <select name="clientId" defaultValue={project?.clientId ?? ""} className={inputCls}>
          <option value="">No {v.client.toLowerCase()}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.company ? ` (${c.company})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Status</span>
        <select name="status" defaultValue={project?.status ?? "planning"} className={inputCls}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Deadline</span>
        <input name="deadline" type="date" defaultValue={project?.deadline ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Budget ({currency})</span>
        <input name="budget" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={project?.budget ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={labelCls}>Notes</span>
        <textarea name="description" maxLength={4000} rows={3} defaultValue={project?.description ?? ""} className={`${inputCls} h-auto py-2`} />
      </label>
    </div>
  );
}

function ProjectCard({
  p,
  client,
  tasks,
  today,
  clients,
  v,
  currency,
}: {
  p: Project;
  client?: Client;
  tasks: Task[];
  today: string;
  clients: Client[];
  v: Template["vocabulary"];
  currency: string;
}) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const overdue = p.deadline && p.status !== "done" && daysBetween(today, p.deadline) < 0;
  const soon = p.deadline && p.status !== "done" && !overdue && daysBetween(today, p.deadline) <= 3;

  return (
    <article className="lift rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-medium leading-snug">{p.title}</h3>
      <p className="mt-1 text-xs text-muted">{client ? client.name : `No ${v.client.toLowerCase()}`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {p.deadline && (
          <span className={`rounded-full px-2 py-0.5 font-medium ${overdue ? "bg-warn/15 text-warn" : soon ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"}`}>
            {overdue ? "Overdue · " : "Due "}
            {relativeDay(p.deadline, today)}
          </span>
        )}
        {p.budget !== null && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
            {currency} {p.budget.toLocaleString("en-US")}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted">
          <span>{total ? `${done}/${total} tasks` : "No tasks yet"}</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="anim-fill h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">Move to</span>
        <StatusSelect action={moveProject} id={p.id} value={p.status} options={statusOptions} label={`Status of ${p.title}`} />
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer list-none text-xs text-accent hover:underline">Edit</summary>
        <div className="pt-3">
          <ActionForm action={saveProject} submitLabel="Save">
            <ProjectFields project={p} clients={clients} v={v} currency={currency} />
          </ActionForm>
          <div className="mt-3 flex justify-end">
            <MiniAction
              action={deleteProject}
              fields={{ id: p.id }}
              confirm={`Delete "${p.title}"? Its tasks stay but will no longer be linked.`}
              className="h-9 cursor-pointer rounded-lg px-3 text-xs text-warn hover:bg-surface-2"
            >
              Delete
            </MiniAction>
          </div>
        </div>
      </details>
    </article>
  );
}

export function ProjectsView({
  template,
  projects,
  clients,
  tasks,
  today,
  currency,
  view,
}: {
  template: Template;
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  today: string;
  currency: string;
  view: "board" | "list";
}) {
  const v = template.vocabulary;
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const tasksFor = (id: string) => tasks.filter((t) => t.projectId === id);
  const byDeadline = (a: Project, b: Project) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
  const card = (p: Project) => (
    <ProjectCard key={p.id} p={p} client={p.clientId ? clientById.get(p.clientId) : undefined} tasks={tasksFor(p.id)} today={today} clients={clients} v={v} currency={currency} />
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{v.projects}</h1>
          <p className="text-sm text-muted">
            {projects.filter((p) => p.status !== "done").length} open · {projects.filter((p) => p.status === "done").length} done
          </p>
        </div>
        <nav aria-label="View" className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {(["board", "list"] as const).map((m) => (
            <Link
              key={m}
              href={m === "board" ? "?view=board" : "?view=list"}
              aria-current={view === m ? "page" : undefined}
              className={`flex h-9 items-center rounded-lg px-3 ${view === m ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
            >
              {m === "board" ? "Board" : "List"}
            </Link>
          ))}
        </nav>
      </header>

      <details className="anim-rise mt-6 rounded-2xl border border-line bg-surface open:border-accent" style={{ animationDelay: "60ms" }}>
        <summary className="flex h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium">
          <Icon name="plus" className="text-accent" /> New {v.project.toLowerCase()}
        </summary>
        <div className="border-t border-line p-5">
          <ActionForm action={saveProject} submitLabel={`Add ${v.project.toLowerCase()}`} resetOnSuccess>
            <ProjectFields clients={clients} v={v} currency={currency} />
          </ActionForm>
        </div>
      </details>

      {projects.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">No {v.projects.toLowerCase()} yet. Add your first one above.</div>
      ) : view === "board" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROJECT_STATUSES.map((s, i) => {
            const col = projects.filter((p) => p.status === s).sort(byDeadline);
            return (
              <section key={s} aria-label={statusLabel[s]} className="anim-rise flex min-w-0 flex-col gap-3 rounded-2xl bg-surface-2/50 p-3" style={{ animationDelay: `${100 + i * 60}ms` }}>
                <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${statusDot[s]}`} aria-hidden="true" />
                  {statusLabel[s]}
                  <span className="ml-auto font-mono text-xs text-muted">{col.length}</span>
                </h2>
                {col.length ? col.map(card) : <p className="px-1 py-6 text-center text-xs text-muted">Nothing here</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">{[...projects].sort(byDeadline).map(card)}</div>
      )}
    </div>
  );
}
