import { toCsv } from "@/lib/csv";
import { convert, type Rates } from "@/lib/fx-math";
import type { Transaction } from "@/lib/data/types";

/**
 * Profit and loss: income and expenses by category and month, in the profile currency, plus a
 * plain export of every transaction. Pure, so the numbers are unit-tested. Other currencies are
 * converted at the rates given (today's), the same way the Money page totals are.
 */

export const PERIODS = [
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-year", label: "This year" },
  { id: "last-year", label: "Last year" },
  { id: "last-12", label: "Last 12 months" },
  { id: "all", label: "All time" },
] as const;
export type Period = (typeof PERIODS)[number]["id"];

const monthKey = (d: string) => d.slice(0, 7);
function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastDay(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** First and last date (inclusive) of a period. "All time" starts at the earliest entry. */
export function periodRange(p: Period, today: string, earliest: string | null): { from: string; to: string; label: string } {
  const month = monthKey(today);
  const year = today.slice(0, 4);
  switch (p) {
    case "this-month":
      return { from: `${month}-01`, to: lastDay(month), label: monthName(month) };
    case "last-month": {
      const m = addMonths(month, -1);
      return { from: `${m}-01`, to: lastDay(m), label: monthName(m) };
    }
    case "this-year":
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: year };
    case "last-year":
      return { from: `${+year - 1}-01-01`, to: `${+year - 1}-12-31`, label: String(+year - 1) };
    case "last-12": {
      const start = addMonths(month, -11);
      return { from: `${start}-01`, to: lastDay(month), label: `${monthName(start)} to ${monthName(month)}` };
    }
    case "all":
      return { from: earliest && earliest < today ? earliest : `${month}-01`, to: today, label: "All time" };
  }
}

function monthName(key: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("en-GB", { month: style, year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

type Row = { category: string; byMonth: number[]; total: number };
export type Pnl = { months: string[]; income: Row[]; expense: Row[]; incomeTotal: number[]; expenseTotal: number[]; net: number[]; unconverted: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildPnl(txns: Transaction[], o: { from: string; to: string; currency: string; fx: Rates }): Pnl {
  const months: string[] = [];
  for (let m = monthKey(o.from); m <= monthKey(o.to) && months.length < 600; m = addMonths(m, 1)) months.push(m);
  const idx = new Map(months.map((m, i) => [m, i]));
  const groups = { income: new Map<string, number[]>(), expense: new Map<string, number[]>() };
  let unconverted = 0;
  for (const t of txns) {
    if (t.date < o.from || t.date > o.to) continue;
    const amount = convert(t.amount, t.currency, o.currency, o.fx);
    if (amount === null) {
      unconverted++;
      continue;
    }
    const row = groups[t.kind].get(t.category) ?? months.map(() => 0);
    row[idx.get(monthKey(t.date))!] += amount;
    groups[t.kind].set(t.category, row);
  }
  const rows = (g: Map<string, number[]>): Row[] =>
    [...g.entries()].map(([category, byMonth]) => ({ category, byMonth: byMonth.map(r2), total: r2(byMonth.reduce((s, v) => s + v, 0)) })).sort((a, b) => b.total - a.total);
  const income = rows(groups.income);
  const expense = rows(groups.expense);
  const sum = (rs: Row[]) => months.map((_, i) => r2(rs.reduce((s, r) => s + r.byMonth[i], 0)));
  const incomeTotal = sum(income);
  const expenseTotal = sum(expense);
  return { months, income, expense, incomeTotal, expenseTotal, net: months.map((_, i) => r2(incomeTotal[i] - expenseTotal[i])), unconverted };
}

const total = (ns: number[]) => r2(ns.reduce((s, v) => s + v, 0));

export function pnlCsv(p: Pnl, o: { label: string; currency: string; liveRates: boolean; name: string }): string {
  const head = ["Category", ...p.months.map((m) => monthName(m, "short")), "Total"];
  const line = (label: string, ns: number[]) => [label, ...ns, total(ns)];
  const rows: (string | number)[][] = [
    [`Profit and loss: ${o.label}`],
    [o.name],
    [`All amounts in ${o.currency}. Other currencies converted at ${o.liveRates ? "today's" : "approximate"} exchange rates.`],
    ...(p.unconverted ? [[`${p.unconverted} entries had no exchange rate and are not included.`]] : []),
    [],
    head,
    ["INCOME"],
    ...p.income.map((r) => line(r.category, r.byMonth)),
    line("Total income", p.incomeTotal),
    [],
    ["EXPENSES"],
    ...p.expense.map((r) => line(r.category, r.byMonth)),
    line("Total expenses", p.expenseTotal),
    [],
    line("Net profit", p.net),
  ];
  return toCsv(rows);
}

export function transactionsCsv(txns: Transaction[], o: { from: string; to: string; currency: string; fx: Rates; clientName: (id: string) => string | undefined }): string {
  const rows = txns
    .filter((t) => t.date >= o.from && t.date <= o.to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((t) => {
      const converted = convert(t.amount, t.currency, o.currency, o.fx);
      const signed = t.kind === "income" ? t.amount : -t.amount;
      return [t.date, t.kind === "income" ? "Income" : "Expense", t.category, t.note ?? "", signed, t.currency, converted === null ? "" : r2(t.kind === "income" ? converted : -converted), t.clientId ? (o.clientName(t.clientId) ?? "") : ""];
    });
  return toCsv([["Date", "Type", "Category", "Description", "Amount", "Currency", `Amount in ${o.currency}`, "Client"], ...rows]);
}
