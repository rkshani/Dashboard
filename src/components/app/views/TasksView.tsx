import { addTask, deleteTask, toggleTask, updateTask } from "@/app/app/work-actions";
import { ActionForm, DoneCheckbox, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { Icon } from "@/components/Sections";
import { daysBetween, relativeDay } from "@/lib/dates";
import { PRIORITIES, type Priority, type Project, type Task } from "@/lib/data/types";
import type { Template } from "@/templates";
import { repeatLabel, TASK_REPEATS, type TaskRepeat } from "@/lib/recurrence";

export function RepeatSelect({ value = "none" }: { value?: TaskRepeat }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>Repeats</span>
      <select name="repeat" defaultValue={value} className={inputCls}>
        {TASK_REPEATS.map((r) => (
          <option key={r} value={r}>
            {repeatLabel[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

const prioTone: Record<Priority, string> = { high: "bg-warn/15 text-warn", normal: "bg-surface-2 text-muted", low: "bg-surface-2 text-muted" };
const prioRank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export function TaskRow({ t, project, today, projects, projectLabel }: { t: Task; project?: Project; today: string; projects: Project[]; projectLabel: string }) {
  const overdue = !t.done && t.dueDate && daysBetween(today, t.dueDate) < 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
      <DoneCheckbox action={toggleTask} id={t.id} done={t.done} title={t.title} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${t.done ? "text-muted line-through" : "font-medium"}`}>{t.title}</p>
        <p className="truncate text-xs text-muted">
          {[t.dueDate ? (overdue ? `Overdue · ${relativeDay(t.dueDate, today)}` : relativeDay(t.dueDate, today)) : null, t.repeat !== "none" ? `↻ ${repeatLabel[t.repeat].toLowerCase()}` : null, project?.title].filter(Boolean).join(" · ") || "No date"}
        </p>
      </div>
      {t.priority !== "normal" && !t.done && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${prioTone[t.priority]}`}>{t.priority}</span>}
      <details className="group order-last basis-full open:mt-1 [&:not([open])]:order-none [&:not([open])]:basis-auto">
        <summary className="flex h-9 min-w-9 cursor-pointer list-none items-center justify-center rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-ink group-open:mb-2 group-open:w-fit" aria-label={`Edit "${t.title}"`}>
          <Icon name="edit" className="h-4 w-4 group-open:hidden" />
          <span className="hidden group-open:inline">Close editor</span>
        </summary>
        <div className="rounded-xl border border-line bg-bg p-3">
          <ActionForm action={updateTask} submitLabel="Save">
            <input type="hidden" name="id" value={t.id} />
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Task</span>
              <input name="title" required maxLength={200} defaultValue={t.title} className={inputCls} />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Due</span>
                <input name="dueDate" type="date" defaultValue={t.dueDate ?? ""} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Priority</span>
                <select name="priority" defaultValue={t.priority} className={inputCls}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{projectLabel}</span>
                <select name="projectId" defaultValue={t.projectId ?? ""} className={inputCls}>
                  <option value="">None</option>
                  {projects
                    .filter((p) => p.status !== "done" || p.id === t.projectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </label>
              <RepeatSelect value={t.repeat} />
            </div>
          </ActionForm>
        </div>
      </details>
      <MiniAction action={deleteTask} fields={{ id: t.id }} label={`Delete "${t.title}"`}>
        <Icon name="close" className="h-4 w-4" />
      </MiniAction>
    </li>
  );
}

export function TasksView({ template, tasks, projects, today }: { template: Template; tasks: Task[]; projects: Project[]; today: string }) {
  const v = template.vocabulary;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const open = tasks.filter((t) => !t.done);
  const sort = (a: Task, b: Task) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || prioRank[a.priority] - prioRank[b.priority];

  const groups = [
    { id: "overdue", title: "Overdue", tone: "text-warn", items: open.filter((t) => t.dueDate && t.dueDate < today).sort(sort) },
    { id: "today", title: "Today", tone: "text-accent", items: open.filter((t) => t.dueDate === today).sort(sort) },
    { id: "upcoming", title: "Upcoming", tone: "text-ink", items: open.filter((t) => t.dueDate && t.dueDate > today).sort(sort) },
    { id: "someday", title: "No date", tone: "text-muted", items: open.filter((t) => !t.dueDate).sort(sort) },
  ];
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
    .slice(0, 30);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="anim-rise">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted">
          {groups[0].items.length} overdue · {groups[1].items.length} due today · {open.length} open
        </p>
      </header>

      <section aria-label="Add a task" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-4" style={{ animationDelay: "60ms" }}>
        <ActionForm action={addTask} submitLabel="Add task" resetOnSuccess>
          <label className="sr-only" htmlFor="task-title">Task</label>
          <input id="task-title" name="title" required maxLength={200} placeholder="What needs doing?" className={`${inputCls} h-12 text-base`} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Due</span>
              <input name="dueDate" type="date" defaultValue={today} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Priority</span>
              <select name="priority" defaultValue="normal" className={`${inputCls} capitalize`}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{v.project}</span>
              <select name="projectId" defaultValue="" className={inputCls}>
                <option value="">None</option>
                {projects
                  .filter((p) => p.status !== "done")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
            <RepeatSelect />
          </div>
        </ActionForm>
      </section>

      {tasks.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">No tasks yet. Add your first one above.</div>}

      {groups
        .filter((g) => g.items.length)
        .map((g, i) => (
          <section key={g.id} aria-labelledby={`g-${g.id}`} className="anim-rise mt-6" style={{ animationDelay: `${120 + i * 60}ms` }}>
            <h2 id={`g-${g.id}`} className={`mb-2 flex items-center gap-2 px-1 text-sm font-semibold ${g.tone}`}>
              {g.title} <span className="font-mono text-xs text-muted">{g.items.length}</span>
            </h2>
            <ul className="rounded-2xl border border-line bg-surface p-1.5">
              {g.items.map((t) => (
                <TaskRow key={t.id} t={t} project={t.projectId ? projectById.get(t.projectId) : undefined} today={today} projects={projects} projectLabel={v.project} />
              ))}
            </ul>
          </section>
        ))}

      {done.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer list-none px-1 text-sm font-semibold text-muted hover:text-ink">
            Done <span className="font-mono text-xs">{done.length}</span>
          </summary>
          <ul className="mt-2 rounded-2xl border border-line bg-surface p-1.5">
            {done.map((t) => (
              <TaskRow key={t.id} t={t} project={t.projectId ? projectById.get(t.projectId) : undefined} today={today} projects={projects} projectLabel={v.project} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
