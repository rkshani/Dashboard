import { addDays } from "@/lib/dates";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/data/types";
import { MONEY_CURRENCIES } from "@/lib/fx-math";

/**
 * Quick add: turns one line like "Lunch 500 PKR yesterday" or "+50000 salary from Acme" into a
 * transaction. Pure and synchronous, so it is easy to test; the server action validates the
 * result again with the normal transaction schema before saving.
 */

export type QuickAddResult =
  | { ok: true; value: { kind: "income" | "expense"; amount: number; currency: string; category: string; date: string; note: string | null } }
  | { ok: false; error: string };

const CODES = new Set<string>(MONEY_CURRENCIES.map((c) => c.toLowerCase()));
const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR" };
const CURRENCY_WORDS: Record<string, string> = {
  dollar: "USD", dollars: "USD", euro: "EUR", euros: "EUR", pound: "GBP", pounds: "GBP",
  dirham: "AED", dirhams: "AED", riyal: "SAR", riyals: "SAR",
};
const MULTIPLIERS: Record<string, number> = {
  k: 1_000, thousand: 1_000, hazar: 1_000, hazaar: 1_000,
  lac: 100_000, lacs: 100_000, lakh: 100_000, lakhs: 100_000,
  m: 1_000_000, million: 1_000_000,
};
const RUPEE_WORDS = new Set(["rs", "rs.", "rupee", "rupees", "rupay", "rupaye"]);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Checked in order; the first phrase found decides. "paid by" must beat "paid".
const INCOME_HINTS = ["paid by", "payment from", "received", "recieved", "receive", "got", "earned", "income", "salary", "retainer", "refund", "sold"];
const EXPENSE_HINTS = ["spent", "paid", "bought", "expense", "bill"];

const EXPENSE_KEYWORDS: [(typeof EXPENSE_CATEGORIES)[number], string[]][] = [
  ["Food", ["lunch", "dinner", "breakfast", "food", "coffee", "tea", "chai", "snack", "snacks", "grocery", "groceries", "restaurant", "pizza", "burger", "meal", "kfc", "foodpanda", "biryani"]],
  ["Transport", ["uber", "careem", "taxi", "cab", "bus", "fuel", "petrol", "diesel", "train", "flight", "metro", "rickshaw", "bykea", "indrive", "parking", "toll"]],
  ["Internet & phone", ["internet", "wifi", "broadband", "phone", "mobile", "sim", "ptcl", "jazz", "zong", "telenor", "ufone", "recharge", "load", "data"]],
  ["Software", ["software", "subscription", "saas", "hosting", "domain", "github", "figma", "adobe", "notion", "chatgpt", "claude", "aws", "vercel", "license", "app"]],
  ["Hardware", ["laptop", "computer", "monitor", "keyboard", "mouse", "headphones", "hardware", "ssd", "charger", "webcam"]],
  ["Rent", ["rent", "office", "coworking"]],
  ["Marketing", ["ads", "advertising", "marketing", "promotion", "boost", "sponsored"]],
  ["Taxes", ["tax", "taxes", "fbr", "vat", "gst"]],
];
const INCOME_KEYWORDS: [(typeof INCOME_CATEGORIES)[number], string[]][] = [
  ["Salary", ["salary", "paycheck", "payroll"]],
  ["Retainer", ["retainer"]],
  ["Fees", ["fee", "fees", "tuition", "tution"]],
  ["Project payment", ["project", "invoice", "client", "milestone", "upwork", "fiverr", "payment"]],
];

// Words that only steer the parse and shouldn't end up in the note: verbs anywhere,
// little linking words only at the start or end ("Spent 500 on lunch" → "Lunch").
const VERBS = new Set(["spent", "paid", "bought", "expense", "income", "received", "recieved", "receive", "got", "earned"]);
const LINKS = new Set(["on", "for", "at", "of", "in", "by", "from", "to"]);

/** Picks a category from words in the text ("uber" → Transport). Also used by CSV import. */
export function guessCategory(kind: "income" | "expense", text: string): string {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/));
  const table = kind === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  return table.find(([, keys]) => keys.some((k) => words.has(k)))?.[0] ?? (kind === "income" ? "Other income" : "Other");
}

const clean = (t: string) => t.toLowerCase().replace(/^[("']+|[)"',.:;!?]+$/g, "");

function monthIndex(t: string) {
  const i = MONTHS.indexOf(t.slice(0, 3));
  return i >= 0 && /^[a-z]{3,9}$/.test(t) ? i : -1;
}

function weekdayIndex(t: string) {
  const i = WEEKDAYS.indexOf(t.slice(0, 3));
  return i >= 0 && /^(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|rsday|urday)?$/.test(t) ? i : -1;
}

function validDate(y: number, m: number, d: number) {
  const iso = `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const back = new Date(`${iso}T00:00:00Z`);
  return back.getUTCMonth() === m && back.getUTCDate() === d ? iso : null;
}

/** Finds a date phrase in the words. Returns the date and which word positions it used. */
function findDate(words: string[], today: string): { date: string; used: number[] } | null {
  const year = Number(today.slice(0, 4));
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1] ?? "";
    if (w === "today" || w === "aaj") return { date: today, used: [i] };
    if (w === "yesterday") return { date: addDays(today, -1), used: [i] };
    if (w === "tomorrow") return { date: addDays(today, 1), used: [i] };
    if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
      const d = validDate(Number(w.slice(0, 4)), Number(w.slice(5, 7)) - 1, Number(w.slice(8, 10)));
      if (d) return { date: d, used: [i] };
    }
    if (/^\d{1,2}$/.test(w) && /^days?$/.test(next) && words[i + 2] === "ago") return { date: addDays(today, -Number(w)), used: [i, i + 1, i + 2] };
    if (w === "last" && weekdayIndex(next) >= 0) {
      const back = (dow - weekdayIndex(next) + 7) % 7 || 7;
      return { date: addDays(today, -back), used: [i, i + 1] };
    }
    if (weekdayIndex(w) >= 0) return { date: addDays(today, -((dow - weekdayIndex(w) + 7) % 7)), used: [i] };

    // "12 nov", "12th november 2025", "nov 12", "november 12 2025"
    const dayFirst = /^(\d{1,2})(st|nd|rd|th)?$/.exec(w);
    const monthFirst = monthIndex(w);
    let day: number | null = null;
    let month = -1;
    let used: number[] = [];
    if (dayFirst && monthIndex(next) >= 0) [day, month, used] = [Number(dayFirst[1]), monthIndex(next), [i, i + 1]];
    else if (monthFirst >= 0) {
      const d = /^(\d{1,2})(st|nd|rd|th)?$/.exec(next);
      if (d) [day, month, used] = [Number(d[1]), monthFirst, [i, i + 1]];
    }
    if (day !== null) {
      const after = words[used[1] + 1] ?? "";
      const explicitYear = /^(19|20)\d{2}$/.test(after) ? Number(after) : null;
      let date = validDate(explicitYear ?? year, month, day);
      // Without a year, a date later than today most likely means last year ("25 dec" logged in January).
      if (date && explicitYear === null && date > today) date = validDate(year - 1, month, day);
      if (date) return { date, used: explicitYear ? [...used, used[1] + 1] : used };
    }
  }
  return null;
}

function parseNumber(raw: string): number | null {
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(k|m|lac|lacs|lakh|lakhs)?$/.exec(raw);
  if (!m) return null;
  const base = Number(`${m[1].replace(/,/g, "")}${m[2] ? `.${m[2]}` : ""}`);
  const mult = m[3] === "k" ? 1_000 : m[3] === "m" ? 1_000_000 : m[3] ? 100_000 : 1;
  return base * mult;
}

function currencyWord(t: string, rupee: string): string | null {
  if (CODES.has(t)) return t.toUpperCase();
  if (CURRENCY_WORDS[t]) return CURRENCY_WORDS[t];
  if (RUPEE_WORDS.has(t)) return rupee;
  return SYMBOLS[t] ?? null;
}

export function parseQuickAdd(input: string, today: string, defaultCurrency: string): QuickAddResult {
  const text = input.trim().slice(0, 200);
  if (!text) return { ok: false, error: 'Type something like "Lunch 500 yesterday".' };
  // "Rs" means rupees in both Pakistan and India; follow the profile when it's one of the two.
  const rupee = defaultCurrency === "INR" ? "INR" : "PKR";

  const original = text.split(/\s+/);
  const words = original.map(clean);
  const used = new Set<number>();

  const date = findDate(words, today);
  date?.used.forEach((i) => used.add(i));

  let amount: number | null = null;
  let currency: string | null = null;
  let sign: "+" | "-" | null = null;
  for (let i = 0; i < words.length && amount === null; i++) {
    if (used.has(i)) continue;
    let t = words[i];
    let tokenSign: "+" | "-" | null = null;
    let tokenCurrency: string | null = null;
    if (t[0] === "+" || t[0] === "-") [tokenSign, t] = [t[0] as "+" | "-", t.slice(1)];
    // Leading symbol or "rs" ("$20", "Rs.500"), trailing code or "/-" ("500pkr", "500/-").
    const pre = /^(\$|€|£|₹|rs\.?)/.exec(t);
    if (pre) [tokenCurrency, t] = [currencyWord(pre[1], rupee), t.slice(pre[1].length)];
    t = t.replace(/\/-$/, "");
    const post = /^(.*?\d[kml]?)([a-z]{3})$/.exec(t);
    if (post && CODES.has(post[2])) [tokenCurrency, t] = [post[2].toUpperCase(), post[1]];
    const n = parseNumber(t);
    if (n === null) continue;
    [amount, sign, currency] = [n, tokenSign, tokenCurrency];
    used.add(i);
    // A multiplier in its own word: "2 lakh", "5 thousand", "3 hazar".
    let end = i;
    const mult = MULTIPLIERS[words[i + 1] ?? ""];
    if (mult && !used.has(i + 1)) {
      amount *= mult;
      used.add(++end);
    }
    // A currency in its own word right before or after the number: "PKR 500", "500 rupees".
    for (const j of [i - 1, end + 1]) {
      if (currency || j < 0 || j >= words.length || used.has(j)) continue;
      const c = currencyWord(words[j], rupee);
      if (c) {
        currency = c;
        used.add(j);
      }
    }
  }
  if (amount === null) return { ok: false, error: 'Add an amount, like "Lunch 500".' };
  // Or anywhere else in the line: "lunch 500 yesterday pkr".
  if (!currency) {
    const j = words.findIndex((w, i) => !used.has(i) && currencyWord(w, rupee) && !SYMBOLS[w]);
    if (j >= 0) {
      currency = currencyWord(words[j], rupee);
      used.add(j);
    }
  }
  currency ??= defaultCurrency;
  if (!(MONEY_CURRENCIES as readonly string[]).includes(currency)) return { ok: false, error: `${currency} isn't supported yet.` };

  const rest = words.filter((_, i) => !used.has(i)).join(" ");
  const has = (phrase: string) => new RegExp(`(^| )${phrase}( |$)`).test(rest);
  const incomeHint = INCOME_HINTS.findIndex(has);
  const expenseHint = EXPENSE_HINTS.findIndex(has);
  const kind: "income" | "expense" = sign === "+" ? "income" : sign === "-" ? "expense" : incomeHint >= 0 && (expenseHint < 0 || has("paid by") || has("payment from")) ? "income" : "expense";

  const category = guessCategory(kind, rest);

  const noteWords = original.filter((w, i) => !used.has(i) && !VERBS.has(clean(w)));
  while (noteWords.length && LINKS.has(clean(noteWords[0]))) noteWords.shift();
  while (noteWords.length && LINKS.has(clean(noteWords[noteWords.length - 1]))) noteWords.pop();
  let note = noteWords.join(" ").slice(0, 300);
  if (note) note = note[0].toUpperCase() + note.slice(1);

  return { ok: true, value: { kind, amount: Math.round(amount * 100) / 100, currency, category, date: date?.date ?? today, note: note || null } };
}
