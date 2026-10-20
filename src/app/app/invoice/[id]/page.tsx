import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repeatInvoice, sendInvoiceToClient, setInvoiceStatus } from "@/app/app/finance-actions";
import { InvoiceBuilder } from "@/components/app/InvoiceBuilder";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { emailConfigured } from "@/lib/email";
import { PrintButton } from "@/components/app/PrintButton";
import { invoiceBadge } from "@/components/app/views/InvoicesView";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { idSchema } from "@/lib/data/types";
import { addDays } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { cadenceLabel, MONEY_CADENCES, nextMoneyDate } from "@/lib/recurrence";
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
  const [invoices, clients, projects, business] = await Promise.all([repo.listInvoices(), repo.listClients(), repo.listProjects(), repo.getBusinessProfile()]);
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
          <a href={`/app/invoice/${inv.id}/pdf`} download className="lift flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface-2">
            Download PDF
          </a>
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
            <p className="mt-2 font-medium">{business.businessName || profile.displayName}</p>
            {business.address && <p className="whitespace-pre-line text-sm text-muted">{business.address}</p>}
            {business.taxId && <p className="text-sm text-muted">Tax ID: {business.taxId}</p>}
            {(business.contactEmail || !user.demo) && <p className="text-sm text-muted">{business.contactEmail ?? user.email}</p>}
            {business.phone && <p className="text-sm text-muted">{business.phone}</p>}
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

        {project && <p className="mt-8 text-sm text-muted">{template.vocabulary.project}: <Link href={`/app/project/${project.id}`} className="text-ink hover:underline">{project.title}</Link></p>}

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

        {business.paymentDetails && (
          <div className="mt-10 rounded-2xl bg-surface-2 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">How to pay</p>
            <p className="mt-2 whitespace-pre-line text-sm">{business.paymentDetails}</p>
          </div>
        )}
        {inv.notes && <p className="mt-8 whitespace-pre-line border-t border-line pt-6 text-sm text-muted">{inv.notes}</p>}
      </article>

      {!business.paymentDetails && (
        <p className="no-print mt-4 text-sm text-muted">
          Tip: add your payment details and business address in <Link href="/app/settings" className="text-accent underline">Settings</Link> so they print on every invoice.
        </p>
      )}

      <section aria-label="Email to client" className="no-print mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Email to {client?.name ?? "client"}</h2>
        {user.demo ? (
          <p className="mt-1 text-sm text-muted">Demo mode: emails aren&apos;t sent. Use Download PDF to share it.</p>
        ) : !client?.email ? (
          <p className="mt-1 text-sm text-muted">
            {client ? <>Add an email address to {client.name} on <Link href={`/app/client/${client.id}`} className="text-accent underline">their profile</Link> first.</> : `Pick a ${template.vocabulary.client.toLowerCase()} for this invoice first.`}
          </p>
        ) : !emailConfigured() ? (
          <p className="mt-1 text-sm text-warn">Email sending isn&apos;t set up on this server yet.</p>
        ) : (
          <ActionForm action={sendInvoiceToClient} submitLabel={inv.status === "draft" ? `Send to ${client.email}` : `Send again to ${client.email}`} className="mt-3">
            <input type="hidden" name="id" value={inv.id} />
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Message (optional)</span>
              <textarea name="message" maxLength={1000} rows={3} placeholder={`Hi ${client.name.split(" ")[0]}, please find invoice ${inv.number} below. Thank you!`} className={`${inputCls} h-auto py-2`} />
            </label>
            <p className="mt-2 text-xs text-muted">Replies go to {business.contactEmail ?? user.email}. A draft is marked as sent.</p>
          </ActionForm>
        )}
      </section>

      <details className="no-print mt-6 rounded-2xl border border-line bg-surface open:border-accent">
        <summary className="flex h-14 cursor-pointer list-none items-center px-5 font-medium">Repeat this invoice</summary>
        <div className="border-t border-line p-5">
          <p className="text-sm text-muted">
            For retainers and monthly fees: a new invoice with the same {template.vocabulary.client.toLowerCase()}, items and payment terms is issued on schedule, with its
            own number.
          </p>
          <ActionForm action={repeatInvoice} submitLabel="Save schedule" className="mt-4">
            <input type="hidden" name="id" value={inv.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Repeats</span>
                <select name="cadence" defaultValue="monthly" className={inputCls}>
                  {MONEY_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {cadenceLabel[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Next invoice on</span>
                <input name="nextDate" type="date" required min={addDays(inv.issueDate, 1)} defaultValue={nextMoneyDate("monthly", inv.issueDate, inv.issueDate)} className={inputCls} />
              </label>
            </div>
            {client?.email && !user.demo && emailConfigured() ? (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" name="autoSend" className="mt-1 accent-[var(--accent)]" />
                <span>
                  Email each new invoice to {client.email} automatically
                  <span className="block text-xs text-muted">Otherwise each one is created as a draft for you to check and send.</span>
                </span>
              </label>
            ) : (
              <p className="mt-3 text-xs text-muted">New invoices are created as drafts for you to check and send.</p>
            )}
          </ActionForm>
        </div>
      </details>

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
