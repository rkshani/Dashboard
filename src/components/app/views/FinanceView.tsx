import Link from "next/link";
import { deleteTransaction } from "@/app/app/finance-actions";
import { MiniAction } from "@/components/app/forms";
import { TransactionForm } from "@/components/app/TransactionForm";
import { Icon } from "@/components/Sections";
import { daysBetween, relativeDay } from "@/lib/dates";
import type { Client, Invoice, Transaction } from "@/lib/data/types";
import { fmtMoney, monthKey, monthLabel, shiftMonth } from "@/lib/money";
import type { Template } from "@/templates";

export function FinanceView({
  template,
  transactions,
  invoices,
  clients,
  today,
  currency,
  month,
  title,
}: {
  template: Template;
  transactions: Transaction[];
  invoices: Invoice[];
  clients: Client[];
  today: string;
  currency: string;
  month: string;
  title: string;
}) {
  const inMonth = transactions.filter((t) => monthKey(t.date) === month);
  const income = inMonth.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = inMonth.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;
  const unpaid = invoices.filter((i) => i.status === "sent");
  const unpaidTotal = unpaid.reduce((s, i) => s + i.total, 0);
  const overdue = unpaid.filter((i) => i.dueDate && i.dueDate < today);

  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const series = months.map((m) => {
    const tx = transactions.filter((t) => monthKey(t.date) === m);
    return {
      m,
      inc: tx.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0),
      exp: tx.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });
  const peak = Math.max(1, ...series.flatMap((s) => [s.inc, s.exp]));

  const byCat = Object.entries(
    inMonth.filter((t) => t.kind === "expense").reduce<Record<string, number>>((acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + t.amount), acc), {}),
  ).sort((a, b) => b[1] - a[1]);
  const catPeak = Math.max(1, ...byCat.map(([, v]) => v));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const isCurrent = month === monthKey(today);
  const incomeLabel = template.id === "teacher" ? "Fee" : "Income";

  const stats = [
    { label: incomeLabel === "Fee" ? "Fees received" : "Income", value: fmtMoney(income, currency), tone: "text-good" },
    { label: "Expenses", value: fmtMoney(expenses, currency), tone: "text-warn" },
    { label: "Net", value: fmtMoney(net, currency), tone: net >= 0 ? "text-ink" : "text-warn" },
    { label: "Unpaid invoices", value: fmtMoney(unpaidTotal, currency), tone: "text-ink", note: overdue.length ? `${overdue.length} overdue` : `${unpaid.length} sent` },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">All amounts in {currency}</p>
        </div>
        <nav aria-label="Month" className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <Link href={`?m=${shiftMonth(month, -1)}`} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            ‹
          </Link>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
          {isCurrent ? (
            <span className="h-9 w-9" aria-hidden="true" />
          ) : (
            <Link href={`?m=${shiftMonth(month, 1)}`} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
              ›
            </Link>
          )}
        </nav>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="lift anim-rise rounded-2xl border border-line bg-surface p-4" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="text-sm text-muted">{s.label}</div>
            <div className={`mt-1 font-display text-2xl font-semibold tracking-tight ${s.tone}`}>{s.value}</div>
            {s.note && <div className="mt-1 text-xs text-muted">{s.note}</div>}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section aria-label="Last six months" className="anim-rise rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "150ms" }}>
          <h2 className="font-display text-lg font-semibold">Last 6 months</h2>
          <div className="mt-4 flex h-48 items-end gap-3">
            {series.map((s, i) => (
              <div key={s.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-40 w-full items-end gap-1">
                  <span
                    className="anim-grow block flex-1 rounded-t-md bg-good"
                    style={{ height: `${(s.inc / peak) * 100}%`, animationDelay: `${250 + i * 60}ms` }}
                    title={`${incomeLabel} ${fmtMoney(s.inc, currency)}`}
                  />
                  <span
                    className="anim-grow block flex-1 rounded-t-md bg-warn/70"
                    style={{ height: `${(s.exp / peak) * 100}%`, animationDelay: `${280 + i * 60}ms` }}
                    title={`Expenses ${fmtMoney(s.exp, currency)}`}
                  />
                </div>
                <span className={`text-xs ${s.m === month ? "font-semibold text-ink" : "text-muted"}`}>{monthLabel(s.m, "short")}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-good" />{incomeLabel}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warn/70" />Expenses</span>
          </div>
          <table className="sr-only">
            <caption>Income and expenses by month</caption>
            <thead><tr><th>Month</th><th>{incomeLabel}</th><th>Expenses</th></tr></thead>
            <tbody>{series.map((s) => <tr key={s.m}><td>{monthLabel(s.m)}</td><td>{fmtMoney(s.inc, currency)}</td><td>{fmtMoney(s.exp, currency)}</td></tr>)}</tbody>
          </table>
        </section>

        <section aria-label="Spending by category" className="anim-rise rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "200ms" }}>
          <h2 className="font-display text-lg font-semibold">Spending by category</h2>
          {byCat.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No expenses this month.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {byCat.map(([cat, v]) => (
                <li key={cat}>
                  <div className="flex justify-between text-sm"><span>{cat}</span><span className="font-mono text-xs text-muted">{fmtMoney(v, currency)}</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="anim-fill h-1.5 rounded-full bg-warn/70" style={{ width: `${(v / catPeak) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section aria-label="Add a transaction" className="anim-rise rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "250ms" }}>
          <h2 className="mb-4 font-display text-lg font-semibold">Add a transaction</h2>
          <TransactionForm today={today} currency={currency} clients={clients.map((c) => ({ id: c.id, name: c.name }))} incomeLabel={incomeLabel} />
        </section>

        <section aria-label="Transactions" className="anim-rise rounded-2xl border border-line bg-surface p-5 lg:col-span-3" style={{ animationDelay: "300ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{monthLabel(month)}</h2>
            {unpaid.length > 0 && (
              <Link href="/app/invoices" className="text-sm text-accent hover:underline">
                {unpaid.length} unpaid {unpaid.length === 1 ? "invoice" : "invoices"}
              </Link>
            )}
          </div>
          {inMonth.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Nothing recorded this month yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...inMonth].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.kind === "income" ? "bg-good/15 text-good" : "bg-warn/15 text-warn"}`} aria-hidden="true">
                    {t.kind === "income" ? "↓" : "↑"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.note || t.category}</span>
                    <span className="block truncate text-xs text-muted">
                      {[t.category, t.clientId ? clientName.get(t.clientId) : null, daysBetween(t.date, today) <= 6 ? relativeDay(t.date, today) : t.date.slice(8) + " " + monthLabel(month, "short")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`font-mono text-sm ${t.kind === "income" ? "text-good" : "text-ink"}`}>
                    {t.kind === "income" ? "+" : "−"}
                    {fmtMoney(t.amount, t.currency)}
                  </span>
                  <MiniAction action={deleteTransaction} fields={{ id: t.id }} label="Delete transaction" confirm={t.invoiceId ? "This came from a paid invoice. Delete it anyway?" : undefined}>
                    <Icon name="close" className="h-4 w-4" />
                  </MiniAction>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
