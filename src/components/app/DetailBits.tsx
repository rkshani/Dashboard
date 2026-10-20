import Link from "next/link";
import type { ReactNode } from "react";
import { invoiceBadge } from "@/components/app/views/InvoicesView";
import type { Invoice } from "@/lib/data/types";
import { fmtMoney } from "@/lib/money";

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InvoiceList({ invoices, today }: { invoices: Invoice[]; today: string }) {
  if (!invoices.length) return <p className="text-sm text-muted">No invoices yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {invoices.map((inv) => {
        const b = invoiceBadge(inv, today);
        return (
          <li key={inv.id} className="flex items-center gap-3 py-2.5 text-sm">
            <Link href={`/app/invoice/${inv.id}`} className="font-mono text-accent hover:underline">
              {inv.number}
            </Link>
            <span className="text-xs text-muted">{inv.issueDate}</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
            <span className="w-28 text-right tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Sums by currency so mixed-currency totals are never added together. */
export function sumByCurrency(rows: { amount: number; currency: string }[], fallback: string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
  if (!m.size) return fmtMoney(0, fallback);
  return [...m].map(([c, a]) => fmtMoney(a, c)).join(" + ");
}
