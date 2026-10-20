import Link from "next/link";
import { deleteTransaction, importTransactionsCsv, stopRecurring } from "@/app/app/finance-actions";
import { MiniAction } from "@/components/app/forms";
import { CsvImport } from "@/components/app/CsvImport";
import { QuickAdd } from "@/components/app/QuickAdd";
import { inputCls, labelCls } from "@/components/app/styles";
import { TransactionForm } from "@/components/app/TransactionForm";
import { Icon } from "@/components/Sections";
import { daysBetween, relativeDay } from "@/lib/dates";
import type { Client, Invoice, RecurringTxn, Transaction } from "@/lib/data/types";
import { cadenceLabel } from "@/lib/recurrence";
import { PERIODS } from "@/lib/reports/pnl";
import { convert, type Rates } from "@/lib/fx-math";
import { fmtMoney, monthKey, monthLabel, shiftMonth } from "@/lib/money";
import type { Template } from "@/templates";

export function FinanceView({
  template,
  transactions: allTransactions,
  recurring,
  fx,
  invoices: allInvoices,
  clients,
  today,
  currency,
  month,
  title,
  children,
}: {
  children?: React.ReactNode;
  template: Template;
  transactions: Transaction[];
  recurring: RecurringTxn[];
  fx: Rates;
  invoices: Invoice[];
  clients: Client[];
  today: string;
  currency: string;
  month: string;
  title: string;
}) {
  // Totals are in the profile currency. Other currencies are converted at today's rates;
  // anything we have no rate for is listed but not added up.
  const toMine = (amount: number, from: string) => convert(amount, from, currency, fx);
  const otherCurrency = allTransactions.filter((t) => t.currency !== currency);
  const unconvertible = otherCurrency.filter((t) => toMine(t.amount, t.currency) === null);
  const transactions = allTransactions.flatMap((t) => {
    const amount = toMine(t.amount, t.currency);
    return amount === null ? [] : [{ ...t, amount }];
  });
  const invoices = allInvoices.flatMap((i) => {
    const total = toMine(i.total, i.currency);
    return total === null ? [] : [{ ...i, total }];
  });
  const inMonthAll = allTransactions.filter((t) => monthKey(t.date) === month);
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
          <p className="text-sm text-muted">
            Totals in {currency}
            {otherCurrency.length > unconvertible.length && (
              <>
                {" "}· other currencies converted at {fx.live ? "today's" : "approximate"} rates (
                <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener" className="underline hover:text-ink">
                  Rates By Exchange Rate API
                </a>
                )
              </>
            )}
            {unconvertible.length > 0 && <> · {unconvertible.length} entries with no exchange rate are listed but not added up</>}
          </p>
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

      {children}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section aria-label="Last six months" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "150ms" }}>
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

        <section aria-label="Spending by category" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "200ms" }}>
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
        <section aria-label="Add a transaction" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "250ms" }}>
          <h2 className="mb-4 font-display text-lg font-semibold">Add a transaction</h2>
          <QuickAdd />
          <p className="my-4 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or fill in the details</p>
          <TransactionForm today={today} currency={currency} clients={clients.map((c) => ({ id: c.id, name: c.name }))} incomeLabel={incomeLabel} />
          <CsvImport
            action={importTransactionsCsv}
            sample={"Date,Description,Amount,Category\n2026-10-01,Lunch with client,-1500,Food\n2026-10-03,Website project,80000,Project payment\n2026-10-05,Internet bill,-3500,\n"}
            sampleName="sample-transactions.csv"
            hint={
              <>
                From your bank or a spreadsheet. It needs a header row with <strong>Date</strong> and <strong>Amount</strong> (or <strong>Debit</strong> and{" "}
                <strong>Credit</strong>); Description, Category, Type and Currency are used when present. Negative amounts are expenses. Dates like 05/10/2026 are
                read day first unless the file shows otherwise. Up to 2,000 rows; entries you already have are skipped.
              </>
            }
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Rows with no minus sign or type are</span>
              <select name="defaultKind" defaultValue="expense" className={inputCls}>
                <option value="expense">Expenses</option>
                <option value="income">{incomeLabel}</option>
              </select>
            </label>
          </CsvImport>
          {recurring.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Repeating</h3>
              <ul className="mt-2 divide-y divide-line">
                {recurring.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{r.note || r.category}</p>
                      <p className="text-xs text-muted">
                        {cadenceLabel[r.cadence]} · Next: {relativeDay(r.nextDate, today)}
                      </p>
                    </div>
                    <span className={`tabular-nums ${r.kind === "income" ? "text-good" : ""}`}>
                      {r.kind === "income" ? "+" : "−"}
                      {fmtMoney(r.amount, r.currency)}
                    </span>
                    <MiniAction action={stopRecurring} fields={{ id: r.id }} confirm={`Stop repeating "${r.note || r.category}"? Entries already added stay.`} className="h-9 cursor-pointer rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-warn">
                      Stop
                    </MiniAction>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-label="Transactions" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 lg:col-span-3" style={{ animationDelay: "300ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{monthLabel(month)}</h2>
            {unpaid.length > 0 && (
              <Link href="/app/invoices" className="text-sm text-accent hover:underline">
                {unpaid.length} unpaid {unpaid.length === 1 ? "invoice" : "invoices"}
              </Link>
            )}
          </div>
          {inMonthAll.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Nothing recorded this month yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...inMonthAll].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
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
                  <MiniAction action={deleteTransaction} fields={{ id: t.id }} label="Delete transaction" confirm={t.invoiceId ? "This came from a paid invoice. Deleting it marks that invoice unpaid again. Continue?" : undefined}>
                    <Icon name="close" className="h-4 w-4" />
                  </MiniAction>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Export" className="anim-rise mt-4 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "350ms" }}>
        <h2 className="font-display text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm text-muted">A spreadsheet for your records or your accountant, in {currency}.</p>
        <form method="get" action="/app/export" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-44 flex-1 flex-col gap-1.5">
            <span className={labelCls}>Report</span>
            <select name="type" defaultValue="pnl" className={inputCls}>
              <option value="pnl">Profit &amp; loss (by category and month)</option>
              <option value="transactions">Every transaction</option>
            </select>
          </label>
          <label className="flex min-w-36 flex-1 flex-col gap-1.5">
            <span className={labelCls}>Period</span>
            <select name="period" defaultValue="this-year" className={inputCls}>
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="lift h-11 cursor-pointer rounded-xl border border-line px-5 text-sm font-medium hover:bg-surface-2">
            Download CSV
          </button>
        </form>
      </section>
    </div>
  );
}
