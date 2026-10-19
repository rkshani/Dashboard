import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setInvoiceStatus } from "@/app/app/finance-actions";
import { InvoiceBuilder } from "@/components/app/InvoiceBuilder";
import { MiniAction } from "@/components/app/forms";
import { PrintButton } from "@/components/app/PrintButton";
import { invoiceBadge } from "@/components/app/views/InvoicesView";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { idSchema } from "@/lib/data/types";
import { fmtMoney } from "@/lib/money";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Invoice" };

export default function InvoicePage({ params }: PageProps<"/app/invoice/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-surface" />}>
      <InvoiceBody params={params} />
    </Suspense>
  );
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

async function InvoiceBody({ params }: { params: PageProps<"/app/invoice/[id]">["params"] }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { user, profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const { repo, today } = await getRepo();
  const [invoices, clients, projects] = await Promise.all([repo.listInvoices(), repo.listClients(), repo.listProjects()]);
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();
  const client = inv.clientId ? clients.find((c) => c.id === inv.clientId) : undefined;
  const project = inv.projectId ? projects.find((p) => p.id === inv.projectId) : undefined;
  const badge = invoiceBadge(inv, today);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/invoices" className="text-sm text-accent hover:underline">
          ← All invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {inv.status !== "paid" && (
            <MiniAction action={setInvoiceStatus} fields={{ id: inv.id, status: "paid" }} className="h-11 cursor-pointer rounded-xl border border-good/40 px-4 text-sm font-medium text-good hover:bg-surface-2">
              Mark paid
            </MiniAction>
          )}
          <PrintButton />
        </div>
      </div>

      {/* The printable invoice */}
      <article className="invoice-sheet anim-rise rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-3xl font-semibold tracking-tight">Invoice</p>
            <p className="mt-1 font-mono text-sm text-muted">{inv.number}</p>
          </div>
          <span className={`no-print rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        </header>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">From</p>
            <p className="mt-2 font-medium">{profile.displayName}</p>
            {!user.demo && <p className="text-sm text-muted">{user.email}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Bill to</p>
            <p className="mt-2 font-medium">{client?.name ?? "—"}</p>
            {client?.company && <p className="text-sm text-muted">{client.company}</p>}
            {client?.email && <p className="text-sm text-muted">{client.email}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Issued</p>
            <p className="mt-2 text-sm">{fmtDate(inv.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{inv.status === "paid" && inv.paidAt ? "Paid" : "Due"}</p>
            <p className="mt-2 text-sm">{inv.status === "paid" && inv.paidAt ? fmtDate(inv.paidAt) : inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"}</p>
          </div>
        </div>

        {project && <p className="mt-8 text-sm text-muted">{template.vocabulary.project}: <span className="text-ink">{project.title}</span></p>}

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th scope="col" className="py-3 font-medium">Description</th>
              <th scope="col" className="py-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-3 text-right font-medium">Rate</th>
              <th scope="col" className="py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-3 pr-4">{it.description}</td>
                <td className="py-3 text-right font-mono">{it.quantity}</td>
                <td className="py-3 text-right font-mono">{fmtMoney(it.rate, inv.currency)}</td>
                <td className="py-3 text-right font-mono">{fmtMoney(it.quantity * it.rate, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="pt-5 text-right font-display text-lg font-semibold">Total</th>
              <td className="pt-5 text-right font-mono text-lg font-semibold">{fmtMoney(inv.total, inv.currency)}</td>
            </tr>
          </tfoot>
        </table>

        {inv.notes && <p className="mt-10 whitespace-pre-line border-t border-line pt-6 text-sm text-muted">{inv.notes}</p>}
      </article>

      {inv.status !== "paid" && (
        <details className="no-print mt-6 rounded-2xl border border-line bg-surface open:border-accent">
          <summary className="flex h-14 cursor-pointer list-none items-center px-5 font-medium">Edit invoice</summary>
          <div className="border-t border-line p-5">
            <InvoiceBuilder
              invoice={inv}
              clients={clients.map((c) => ({ id: c.id, name: c.name }))}
              projects={projects.map((p) => ({ id: p.id, title: p.title, clientId: p.clientId }))}
              today={today}
              currency={inv.currency}
              clientLabel={template.vocabulary.client}
              projectLabel={template.vocabulary.project}
            />
          </div>
        </details>
      )}
    </div>
  );
}
