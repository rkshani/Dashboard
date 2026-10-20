import { findColumns } from "@/lib/csv";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, transactionInput, type TransactionInput } from "@/lib/data/types";
import { MONEY_CURRENCIES } from "@/lib/fx-math";
import { guessCategory } from "@/lib/quick-add";

/**
 * Turns CSV rows (from a bank statement or a spreadsheet) into transactions.
 * Columns are found by their header names, so the order doesn't matter. Pure, so it is tested
 * directly; the server action only adds the file checks, duplicate skipping and saving.
 */

export type ImportedTransaction = Omit<TransactionInput, "invoiceId">;
export type ImportResult = { rows: ImportedTransaction[]; skipped: { line: number; reason: string }[]; error?: string };

const HEADERS = {
  date: ["date", "transaction date", "txn date", "posting date", "post date", "value date", "booking date", "day"],
  amount: ["amount", "value", "sum", "total", "amt"],
  debit: ["debit", "debits", "withdrawal", "withdrawals", "money out", "paid out", "out", "expense", "expenses", "spent"],
  credit: ["credit", "credits", "deposit", "deposits", "money in", "paid in", "in", "income", "received"],
  type: ["type", "kind", "transaction type", "dr/cr", "cr/dr", "debit/credit"],
  category: ["category", "categories", "head"],
  note: ["description", "note", "notes", "details", "narration", "memo", "particulars", "payee", "merchant", "remarks", "title", "name", "item"],
  currency: ["currency", "ccy", "cur"],
} as const;
type Field = keyof typeof HEADERS;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR" };

/** Finds which column holds each field. A header like "Amount (PKR)" still counts as amount. */
export const mapHeaders = (header: string[]) => findColumns<Field>(header, HEADERS);

/** "1,234.50", "(500)", "-500", "Rs 500", "$12", "500 DR" → number (negative = money out) and any currency found. */
export function parseAmount(raw: string, rupee: string): { value: number; currency: string | null; drcr: "dr" | "cr" | null } | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  let currency: string | null = null;
  let drcr: "dr" | "cr" | null = null;
  const tail = /\s*(dr|cr)\.?$/.exec(s);
  if (tail) [drcr, s] = [tail[1] as "dr" | "cr", s.slice(0, tail.index)];
  const code = /([a-z]{3})/.exec(s.replace(/^rs\.?|rs\.?$/g, ""));
  if (code && (MONEY_CURRENCIES as readonly string[]).includes(code[1].toUpperCase())) currency = code[1].toUpperCase();
  if (/(^|[^a-z])rs\.?/.test(s)) currency ??= rupee;
  for (const [sym, c] of Object.entries(SYMBOLS)) if (s.includes(sym)) currency ??= c;
  const negative = /^\(.*\)$/.test(s.replace(/[^\d().,-]/g, "")) || /-\s*[\d.,]/.test(s) || /[\d.,]\s*-$/.test(s);
  const digits = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(digits)) return null;
  // "1.234,50" (European) vs "1,234.50": the last separator with 1–2 digits after it is the decimal point.
  const lastSep = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  const decimals = lastSep >= 0 && /^\d{1,2}$/.test(digits.slice(lastSep + 1)) ? digits.slice(lastSep + 1) : "";
  const whole = (decimals ? digits.slice(0, lastSep) : digits).replace(/[.,]/g, "");
  const value = Number(`${whole || "0"}${decimals ? `.${decimals}` : ""}`);
  if (!Number.isFinite(value)) return null;
  return { value: negative ? -value : value, currency, drcr };
}

/**
 * Decides whether slashed dates in this file are day-first (12/10/2026 = 12 Oct) or month-first.
 * Any value whose first part is above 12 proves day-first, and the other way round. With no proof,
 * day-first wins, as used in Pakistan, India, the UK and most of the world.
 */
export function detectDayFirst(values: string[]): boolean {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  return dayFirst || !monthFirst;
}

const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(`${s}T00:00:00Z`).getUTCDate() === d ? s : null;
}

/** "2026-10-12", "2026/10/12", "12/10/2026", "12-Oct-2026", "12 Oct 26", "Oct 12, 2026", with an optional time after. */
export function parseDate(raw: string, dayFirst: boolean): string | null {
  const s = raw.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  // An Excel date serial (days since 30 Dec 1899), when a sheet is saved without date formatting.
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86_400_000).toISOString().slice(0, 10);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(s);
  if (m) return dayFirst ? iso(+m[3], +m[2], +m[1]) : iso(+m[3], +m[1], +m[2]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]([a-z]{3,9})[\s-](\d{2,4})\b/.exec(s);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return iso(+m[3], MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]);
  m = /^([a-z]{3,9})[\s-](\d{1,2})(?:st|nd|rd|th)?[\s-](\d{2,4})\b/.exec(s);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return iso(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]);
  return null;
}

function kindFromText(v: string): "income" | "expense" | null {
  const s = v.trim().toLowerCase();
  if (/^(income|credit|cr|deposit|in|received|receipt|\+)$/.test(s)) return "income";
  if (/^(expense|debit|dr|withdrawal|out|payment|spent|-)$/.test(s)) return "expense";
  return null;
}

export function mapTransactions(rows: string[][], opts: { defaultCurrency: string; defaultKind: "income" | "expense"; maxRows?: number }): ImportResult {
  const [header, ...body] = rows;
  if (!header) return { rows: [], skipped: [], error: "The file is empty." };
  const col = mapHeaders(header);
  if (col.date === undefined) return { rows: [], skipped: [], error: 'No "Date" column found. Add a header row with Date and Amount (or Debit and Credit).' };
  if (col.amount === undefined && col.debit === undefined && col.credit === undefined) return { rows: [], skipped: [], error: 'No "Amount" column found (or "Debit" and "Credit").' };
  const max = opts.maxRows ?? 2000;
  if (body.length > max) return { rows: [], skipped: [], error: `That's ${body.length} rows. Import up to ${max} at a time: split the file and try again.` };

  const rupee = opts.defaultCurrency === "INR" ? "INR" : "PKR";
  const at = (r: string[], f: Field) => (col[f] === undefined ? "" : (r[col[f]!] ?? "").trim());
  const dayFirst = detectDayFirst(body.map((r) => at(r, "date")));
  // In a bank export, money out is negative, so positive must mean money in. In a plain list of
  // spending with no signs, positive rows use the default the user picked.
  const signed = col.amount !== undefined && body.some((r) => (parseAmount(at(r, "amount"), rupee)?.value ?? 0) < 0);

  const out: ImportedTransaction[] = [];
  const skipped: ImportResult["skipped"] = [];
  body.forEach((r, idx) => {
    const line = idx + 2; // 1-based, after the header, as a spreadsheet shows it
    const date = parseDate(at(r, "date"), dayFirst);
    if (!date) return skipped.push({ line, reason: at(r, "date") ? `couldn't read the date "${at(r, "date").slice(0, 20)}"` : "no date" });

    let kind: "income" | "expense" | null = col.type !== undefined ? kindFromText(at(r, "type")) : null;
    let parsed = null;
    const debit = col.debit !== undefined ? parseAmount(at(r, "debit"), rupee) : null;
    const credit = col.credit !== undefined ? parseAmount(at(r, "credit"), rupee) : null;
    if (debit && debit.value !== 0) [parsed, kind] = [debit, kind ?? "expense"];
    else if (credit && credit.value !== 0) [parsed, kind] = [credit, kind ?? "income"];
    else if (col.amount !== undefined) {
      parsed = parseAmount(at(r, "amount"), rupee);
      if (parsed) kind ??= parsed.drcr === "dr" ? "expense" : parsed.drcr === "cr" ? "income" : parsed.value < 0 ? "expense" : signed ? "income" : opts.defaultKind;
    }
    if (!parsed || parsed.value === 0) return skipped.push({ line, reason: "no amount" });
    kind ??= opts.defaultKind;

    const named = at(r, "currency").toUpperCase();
    const currency = (MONEY_CURRENCIES as readonly string[]).includes(named) ? named : (parsed.currency ?? opts.defaultCurrency);
    if (named && named !== currency) return skipped.push({ line, reason: `${named.slice(0, 5)} isn't a supported currency` });

    const note = at(r, "note").replace(/\s+/g, " ").slice(0, 300);
    const given = at(r, "category");
    const known = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find((c) => c.toLowerCase() === given.toLowerCase());
    const category = (known ?? given.slice(0, 40)) || guessCategory(kind, note);

    const valid = transactionInput.safeParse({ kind, amount: Math.abs(parsed.value), category, date, note: note || undefined });
    if (!valid.success) return skipped.push({ line, reason: valid.error.issues[0].message.replace(/\.$/, "").toLowerCase() });
    out.push({ ...valid.data, currency });
  });
  return { rows: out, skipped };
}

/** A key that matches the same entry if the same file is imported twice. */
export const txKey = (t: { date: string; kind: string; amount: number; currency: string; note: string | null }) => [t.date, t.kind, t.amount.toFixed(2), t.currency, (t.note ?? "").toLowerCase()].join("|");
