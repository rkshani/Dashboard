/** Date maths for repeating tasks and transactions. Dates are YYYY-MM-DD strings in the user's timezone. */
export const TASK_REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number];
export const MONEY_CADENCES = ["weekly", "monthly", "yearly"] as const;
export type MoneyCadence = (typeof MONEY_CADENCES)[number];

export const repeatLabel: Record<TaskRepeat, string> = { none: "Doesn't repeat", daily: "Every day", weekdays: "Every weekday", weekly: "Every week", monthly: "Every month" };
export const cadenceLabel: Record<MoneyCadence, string> = { weekly: "Every week", monthly: "Every month", yearly: "Every year" };

const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
};
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addDaysISO(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Adds months, keeping `anchorDay` (e.g. the 31st) and clamping to short months: 31 Jan → 28 Feb → 31 Mar. */
export function addMonthsISO(d: string, n: number, anchorDay?: number) {
  const { y, m, day } = parse(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(anchorDay ?? day, daysInMonth(ny, nm)));
}

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/** Next due date for a repeating task, never in the past (a task done late doesn't create a backlog). */
export function nextTaskDate(repeat: TaskRepeat, due: string | null, today: string): string | null {
  if (repeat === "none") return null;
  const base = due ?? today;
  const anchor = parse(base).day;
  let next = base;
  for (let i = 0; i < 500; i++) {
    if (repeat === "daily") next = addDaysISO(next, 1);
    else if (repeat === "weekdays") {
      next = addDaysISO(next, 1);
      while (weekday(next) === 0 || weekday(next) === 6) next = addDaysISO(next, 1);
    } else if (repeat === "weekly") next = addDaysISO(next, 7);
    else next = addMonthsISO(next, 1, anchor);
    if (next > today) return next;
  }
  return null;
}

/** Next occurrence of a repeating money entry after `date`, anchored to the start date's day of month. */
export function nextMoneyDate(cadence: MoneyCadence, date: string, startDate: string) {
  const anchor = parse(startDate).day;
  if (cadence === "weekly") return addDaysISO(date, 7);
  if (cadence === "monthly") return addMonthsISO(date, 1, anchor);
  return addMonthsISO(date, 12, anchor);
}

/** All dates from `next` up to and including `today` (capped so a long-paused rule can't flood the ledger). */
export function dueOccurrences(cadence: MoneyCadence, next: string, startDate: string, today: string, cap = 24) {
  const out: string[] = [];
  let d = next;
  while (d <= today && out.length < cap) {
    out.push(d);
    d = nextMoneyDate(cadence, d, startDate);
  }
  return { dates: out, next: d };
}
