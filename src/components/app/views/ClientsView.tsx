import Link from "next/link";
import { deleteClient, saveClient } from "@/app/app/work-actions";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { Icon } from "@/components/Sections";
import { CLIENT_STATUSES, type Client, type Project } from "@/lib/data/types";
import type { Template } from "@/templates";

export const clientStatusLabel: Record<Client["status"], string> = { lead: "Lead", active: "Active", past: "Past" };
export const clientStatusTone: Record<Client["status"], string> = { lead: "bg-warn/15 text-warn", active: "bg-good/15 text-good", past: "bg-surface-2 text-muted" };

export function ClientFields({ client, v }: { client?: Client; v: Template["vocabulary"] }) {
  const uid = client?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {client && <input type="hidden" name="id" value={client.id} />}
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Name *</span>
        <input name="name" required maxLength={120} defaultValue={client?.name} className={inputCls} placeholder={`${v.client} name`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Company / organisation</span>
        <input name="company" maxLength={120} defaultValue={client?.company ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Email</span>
        <input name="email" type="email" maxLength={254} defaultValue={client?.email ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Phone / WhatsApp</span>
        <input name="phone" type="tel" maxLength={40} defaultValue={client?.phone ?? ""} className={inputCls} />
      </label>
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className={labelCls}>Status</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CLIENT_STATUSES.map((s) => (
            <label key={s} className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm has-[:checked]:border-accent">
              <input type="radio" name="status" value={s} defaultChecked={(client?.status ?? "active") === s} className="accent-[var(--accent)]" id={`${uid}-${s}`} />
              {clientStatusLabel[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={labelCls}>Notes</span>
        <textarea name="notes" maxLength={4000} rows={3} defaultValue={client?.notes ?? ""} className={`${inputCls} h-auto py-2`} />
      </label>
    </div>
  );
}

export function ClientsView({ template, clients, projects }: { template: Template; clients: Client[]; projects: Project[] }) {
  const v = template.vocabulary;
  const projectCount = (id: string) => projects.filter((p) => p.clientId === id).length;
  const order: Client["status"][] = ["active", "lead", "past"];
  const sorted = [...clients].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{v.clients}</h1>
          <p className="text-sm text-muted">
            {clients.filter((c) => c.status === "active").length} active · {clients.filter((c) => c.status === "lead").length} leads · {clients.length} total
          </p>
        </div>
      </header>

      <details className="anim-rise group mt-6 rounded-2xl border border-line bg-surface open:border-accent" style={{ animationDelay: "60ms" }}>
        <summary className="flex h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium">
          <Icon name="plus" className="text-accent" /> New {v.client.toLowerCase()}
        </summary>
        <div className="border-t border-line p-5">
          <ActionForm action={saveClient} submitLabel={`Add ${v.client.toLowerCase()}`} resetOnSuccess>
            <ClientFields v={v} />
          </ActionForm>
        </div>
      </details>

      {clients.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">
          No {v.clients.toLowerCase()} yet. Add your first one above.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {sorted.map((c, i) => (
            <li key={c.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 10) * 40 + 100}ms` }}>
              <details className="group rounded-2xl border border-line bg-surface open:border-accent">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-display text-lg font-semibold text-accent" aria-hidden="true">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-[1_1_180px]">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{[c.company, c.email].filter(Boolean).join(" · ") || "No details yet"}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {projectCount(c.id)} {projectCount(c.id) === 1 ? v.project.toLowerCase() : v.projects.toLowerCase()}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clientStatusTone[c.status]}`}>{clientStatusLabel[c.status]}</span>
                </summary>
                <div className="border-t border-line p-5">
                  <Link href={`/app/client/${c.id}`} className="lift mb-4 inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
                    Open full profile →
                  </Link>
                  <ActionForm action={saveClient} submitLabel="Save changes">
                    <ClientFields client={c} v={v} />
                  </ActionForm>
                  <div className="mt-4 flex justify-end border-t border-line pt-4">
                    <MiniAction
                      action={deleteClient}
                      fields={{ id: c.id }}
                      confirm={`Delete ${c.name}? Their ${v.projects.toLowerCase()} stay but will no longer be linked.`}
                      className="h-10 cursor-pointer rounded-xl px-3 text-sm text-warn hover:bg-surface-2"
                    >
                      Delete {v.client.toLowerCase()}
                    </MiniAction>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
