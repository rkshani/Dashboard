import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClient, saveClient } from "@/app/app/work-actions";
import { InvoiceList, Panel, Stat, sumByCurrency } from "@/components/app/DetailBits";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { ClientFields, clientStatusLabel, clientStatusTone } from "@/components/app/views/ClientsView";
import { projectStatusLabel } from "@/components/app/views/ProjectsView";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { idSchema } from "@/lib/data/types";
import { relativeDay } from "@/lib/dates";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params }: PageProps<"/app/client/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-surface" />}>
      <ClientBody params={params} />
    </Suspense>
  );
}

/** wa.me needs digits only, with the country code. Returns null if it doesn't look like a phone number. */
function whatsapp(phone: string) {
  const d = phone.replace(/[^\d]/g, "");
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

async function ClientBody({ params }: { params: PageProps<"/app/client/[id]">["params"] }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const v = template.vocabulary;
  const { repo, today, currency } = await getRepo();
  const [clients, projects, tasks, invoices, txns] = await Promise.all([repo.listClients(), repo.listProjects(), repo.listTasks(), repo.listInvoices(), repo.listTransactions()]);
  const c = clients.find((x) => x.id === id);
  if (!c) notFound();
  const myProjects = projects.filter((p) => p.clientId === c.id);
  const myInvoices = invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const income = txns.filter((t) => t.kind === "income" && t.clientId === c.id);
  const billed = myInvoices.filter((i) => i.status !== "draft").map((i) => ({ amount: i.total, currency: i.currency }));
  const outstanding = myInvoices.filter((i) => i.status === "sent").map((i) => ({ amount: i.total, currency: i.currency }));
  const overdueCount = myInvoices.filter((i) => i.status === "sent" && i.dueDate && i.dueDate < today).length;
  const wa = c.phone ? whatsapp(c.phone) : null;
  const listLabel = template.modules.find((m) => m.id === "clients")?.label ?? v.clients;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/clients" className="text-sm text-accent hover:underline">
        ← All {listLabel.toLowerCase()}
      </Link>
      <header className="anim-rise mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{c.name}</h1>
          {c.company && <p className="mt-1 text-sm text-muted">{c.company}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${clientStatusTone[c.status]}`}>{clientStatusLabel[c.status]}</span>
      </header>

      {(c.email || c.phone) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {c.email && (
            <a href={`mailto:${c.email}`} className="lift inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm hover:border-accent">
              Email {c.email}
            </a>
          )}
          {c.phone && (
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="lift inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm hover:border-accent">
              Call {c.phone}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="lift inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm hover:border-accent">
              WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={v.projects} value={String(myProjects.length)} />
        <Stat label="Billed" value={sumByCurrency(billed, currency)} />
        <Stat label="Received" value={sumByCurrency(income, currency)} tone="good" />
        <Stat label={overdueCount ? `Outstanding · ${overdueCount} overdue` : "Outstanding"} value={sumByCurrency(outstanding, currency)} tone={outstanding.length ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={v.projects}>
            {myProjects.length ? (
              <ul className="flex flex-col gap-2">
                {myProjects.map((p) => {
                  const pt = tasks.filter((t) => t.projectId === p.id);
                  const pct = pt.length ? Math.round((pt.filter((t) => t.done).length / pt.length) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/app/project/${p.id}`} className="block rounded-xl border border-line p-3 hover:border-accent">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium">{p.title}</span>
                          <span className="shrink-0 text-xs text-muted">{projectStatusLabel[p.status]}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono">{pct}%</span>
                          {p.deadline && p.status !== "done" && <span>Due {relativeDay(p.deadline, today)}</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No {v.projects.toLowerCase()} for {c.name} yet.</p>
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
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {c.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-wrap text-sm text-muted">{c.notes}</p>
            </Panel>
          )}
          <Panel title={`Edit ${v.client.toLowerCase()}`}>
            <ActionForm action={saveClient} submitLabel="Save changes">
              <ClientFields client={c} v={v} />
            </ActionForm>
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <MiniAction
                action={deleteClient}
                fields={{ id: c.id, then: "/app/clients" }}
                confirm={`Delete ${c.name}? Their ${v.projects.toLowerCase()} and invoices stay but will no longer be linked.`}
                className="h-9 cursor-pointer rounded-lg px-3 text-xs text-warn hover:bg-surface-2"
              >
                Delete {v.client.toLowerCase()}
              </MiniAction>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
