import Link from "next/link";
import { deleteInvoice, setInvoiceStatus } from "@/app/app/finance-actions";
import { InvoiceBuilder } from "@/components/app/InvoiceBuilder";
import { MiniAction } from "@/components/app/forms";
import { Icon } from "@/components/Sections";
import { relativeDay } from "@/lib/dates";
import type { Client, Invoice, Project } from "@/lib/data/types";
import { toCurrency, type Rates } from "@/lib/fx-math";
import { fmtMoney } from "@/lib/money";
import type { Template } from "@/templates";

export function invoiceBadge(inv: Invoice, today: string) {
  if (inv.status === "paid") return { label: "Paid", cls: "bg-good/15 text-good" };
  if (inv.status === "draft") return { label: "Draft", cls: "bg-surface-2 text-muted" };
  if (inv.dueDate && inv.dueDate < today) return { label: "Overdue", cls: "bg-warn/15 text-warn" };
  return { label: "Sent", cls: "bg-accent/15 text-accent" };
}

const btn = "h-9 cursor-pointer rounded-lg border border-line px-3 text-xs font-medium hover:border-accent";

export function InvoicesView({
  template,
  invoices,
  clients,
  projects,
  today,
  currency,
  fx,
  defaultDueDate,
}: {
  template: Template;
  invoices: Invoice[];
  clients: Client[];
  projects: Project[];
  today: string;
  currency: string;
  fx: Rates;
  defaultDueDate: string | null;
}) {
  const v = template.vocabulary;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  // Mixed currencies are converted to the profile currency for these two totals.
  const inMine = toCurrency(invoices, "total", currency, fx);
  const outstanding = inMine.filter((i) => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const paidTotal = inMine.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="anim-rise">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted">
          {fmtMoney(outstanding, currency)} outstanding · {fmtMoney(paidTotal, currency)} paid so far
        </p>
      </header>

      <details className="anim-rise mt-6 rounded-2xl border border-line bg-surface open:border-accent" style={{ animationDelay: "60ms" }}>
        <summary className="flex h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium">
          <Icon name="plus" className="text-accent" /> New invoice
        </summary>
        <div className="border-t border-line p-5">
          <InvoiceBuilder
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            projects={projects.map((p) => ({ id: p.id, title: p.title, clientId: p.clientId }))}
            today={today}
            currency={currency}
            defaultDueDate={defaultDueDate}
            clientLabel={v.client}
            projectLabel={v.project}
          />
        </div>
      </details>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">No invoices yet. Create your first one above.</div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {invoices.map((inv, i) => {
            const b = invoiceBadge(inv, today);
            return (
              <li key={inv.id} className="lift anim-rise flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4" style={{ animationDelay: `${100 + Math.min(i, 10) * 40}ms` }}>
                <Link href={`/app/invoice/${inv.id}`} className="min-w-0 flex-[1_1_200px] hover:underline">
                  <span className="block font-mono text-sm font-semibold">{inv.number}</span>
                  <span className="block truncate text-xs text-muted">
                    {[inv.clientId ? clientName.get(inv.clientId) : `No ${v.client.toLowerCase()}`, inv.status === "paid" && inv.paidAt ? `paid ${relativeDay(inv.paidAt, today).toLowerCase()}` : inv.dueDate ? `due ${relativeDay(inv.dueDate, today).toLowerCase()}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
                <span className="font-mono text-sm font-semibold">{fmtMoney(inv.total, inv.currency)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.cls}`}>{b.label}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {inv.status === "draft" && (
                    <MiniAction action={setInvoiceStatus} fields={{ id: inv.id, status: "sent" }} className={btn}>
                      Mark sent
                    </MiniAction>
                  )}
                  {inv.status !== "paid" && (
                    <MiniAction action={setInvoiceStatus} fields={{ id: inv.id, status: "paid" }} className={`${btn} border-good/40 text-good`}>
                      Mark paid
                    </MiniAction>
                  )}
                  {inv.status === "paid" && (
                    <MiniAction action={setInvoiceStatus} fields={{ id: inv.id, status: "sent" }} confirm="Mark as unpaid? The income entry it created will be removed." className={btn}>
                      Undo paid
                    </MiniAction>
                  )}
                  <Link href={`/app/invoice/${inv.id}`} className={`${btn} flex items-center`}>
                    Open
                  </Link>
                  <MiniAction action={deleteInvoice} fields={{ id: inv.id }} label={`Delete ${inv.number}`} confirm={`Delete ${inv.number}?`}>
                    <Icon name="close" className="h-4 w-4" />
                  </MiniAction>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
