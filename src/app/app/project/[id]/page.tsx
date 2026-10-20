import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addTask, deleteProject, moveProject, saveProject } from "@/app/app/work-actions";
import { InvoiceList, Panel, Stat, sumByCurrency } from "@/components/app/DetailBits";
import { ActionForm, MiniAction, StatusSelect } from "@/components/app/forms";
import { inputCls } from "@/components/app/styles";
import { ProjectFields, projectStatusOptions } from "@/components/app/views/ProjectsView";
import { TaskRow } from "@/components/app/views/TasksView";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { idSchema } from "@/lib/data/types";
import { daysBetween, relativeDay } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({ params }: PageProps<"/app/project/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-surface" />}>
      <ProjectBody params={params} />
    </Suspense>
  );
}

async function ProjectBody({ params }: { params: PageProps<"/app/project/[id]">["params"] }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const v = template.vocabulary;
  const { repo, today, currency } = await getRepo();
  const [projects, clients, tasks, invoices, txns] = await Promise.all([repo.listProjects(), repo.listClients(), repo.listTasks(), repo.listInvoices(), repo.listTransactions()]);
  const p = projects.find((x) => x.id === id);
  if (!p) notFound();
  const client = p.clientId ? clients.find((c) => c.id === p.clientId) : undefined;
  const myTasks = tasks.filter((t) => t.projectId === p.id).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const myInvoices = invoices.filter((i) => i.projectId === p.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const myTxns = txns.filter((t) => t.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const done = myTasks.filter((t) => t.done).length;
  const pct = myTasks.length ? Math.round((done / myTasks.length) * 100) : 0;
  const overdue = p.deadline && p.status !== "done" && daysBetween(today, p.deadline) < 0;
  const income = myTxns.filter((t) => t.kind === "income");
  const expenses = myTxns.filter((t) => t.kind === "expense");
  const unpaid = myInvoices.filter((i) => i.status !== "paid").map((i) => ({ amount: i.total, currency: i.currency }));

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/projects" className="text-sm text-accent hover:underline">
        ← All {v.projects.toLowerCase()}
      </Link>
      <header className="anim-rise mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{p.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {client ? (
              <Link href={`/app/client/${client.id}`} className="underline hover:text-ink">
                {client.name}
              </Link>
            ) : (
              `No ${v.client.toLowerCase()}`
            )}
            {p.deadline && (
              <span className={overdue ? "text-warn" : ""}>
                {" · "}
                {overdue ? "Overdue, was due " : "Due "}
                {relativeDay(p.deadline, today)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect action={moveProject} id={p.id} value={p.status} options={projectStatusOptions} label={`Status of ${p.title}`} />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Progress" value={myTasks.length ? `${pct}% · ${done}/${myTasks.length}` : "No tasks"} />
        <Stat label="Budget" value={p.budget !== null ? fmtMoney(p.budget, currency) : "Not set"} />
        <Stat label="Received" value={sumByCurrency(income, currency)} tone="good" />
        <Stat label="Unpaid invoices" value={sumByCurrency(unpaid, currency)} tone={unpaid.length ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Tasks">
            <ActionForm action={addTask} submitLabel="Add" resetOnSuccess>
              <input type="hidden" name="projectId" value={p.id} />
              <input type="hidden" name="priority" value="normal" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="ptask">New task</label>
                <input id="ptask" name="title" required maxLength={200} placeholder={`Add a task to ${p.title}`} className={`${inputCls} w-full sm:flex-1`} />
                <label className="sr-only" htmlFor="pdue">Due</label>
                <input id="pdue" name="dueDate" type="date" className={`${inputCls} sm:w-40`} />
              </div>
            </ActionForm>
            {myTasks.length ? (
              <ul className="mt-3 flex flex-col">
                {myTasks.map((t) => (
                  <TaskRow key={t.id} t={t} project={p} today={today} projects={projects} projectLabel={v.project} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No tasks yet.</p>
            )}
          </Panel>

          <Panel
            title="Invoices"
            action={
              <Link href="/app/invoices" className="text-xs text-accent hover:underline">
                New invoice
              </Link>
            }
          >
            <InvoiceList invoices={myInvoices} today={today} />
          </Panel>

          <Panel title="Money in and out">
            {myTxns.length ? (
              <ul className="divide-y divide-line">
                {myTxns.slice(0, 20).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-xs text-muted">{t.date}</span>
                    <span className="min-w-0 flex-1 truncate">{t.note || t.category}</span>
                    <span className={`tabular-nums ${t.kind === "income" ? "text-good" : ""}`}>
                      {t.kind === "income" ? "+" : "−"}
                      {fmtMoney(t.amount, t.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing recorded for this {v.project.toLowerCase()} yet.</p>
            )}
            {expenses.length > 0 && <p className="mt-3 text-xs text-muted">Spent: {sumByCurrency(expenses, currency)}</p>}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {p.description && (
            <Panel title="About">
              <p className="whitespace-pre-wrap text-sm text-muted">{p.description}</p>
            </Panel>
          )}
          <Panel title={`Edit ${v.project.toLowerCase()}`}>
            <ActionForm action={saveProject} submitLabel="Save changes">
              <ProjectFields project={p} clients={clients} v={v} currency={currency} />
            </ActionForm>
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <MiniAction
                action={deleteProject}
                fields={{ id: p.id, then: "/app/projects" }}
                confirm={`Delete "${p.title}"? Its tasks stay but will no longer be linked.`}
                className="h-9 cursor-pointer rounded-lg px-3 text-xs text-warn hover:bg-surface-2"
              >
                Delete {v.project.toLowerCase()}
              </MiniAction>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
