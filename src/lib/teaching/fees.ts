import type { AttendanceEntry, Client, Transaction } from "@/lib/data/types";
import { addDaysISO } from "@/lib/recurrence";

export type FeeStatus = "paid" | "partial" | "upcoming" | "due" | "overdue";
export type FeeRow = { student: Client; fee: number; paid: number; dueDate: string; status: FeeStatus; daysLate: number };

export const FEE_CATEGORY = "Fees";
/** A fee counts as overdue once it is this many days late (and the reminder rule fires). */
export const FEE_GRACE_DAYS = 3;

export function feeDueDate(month: string, day: number | null) {
  return `${month}-${String(Math.min(Math.max(day ?? 1, 1), 28)).padStart(2, "0")}`;
}

/** Fee status for every active student with a fee, for one month (YYYY-MM). Pure. */
export function feeRows(students: Client[], transactions: Transaction[], month: string, today: string): FeeRow[] {
  return students
    .filter((s) => s.status === "active" && s.monthlyFee && s.monthlyFee > 0)
    .map((student) => {
      const fee = student.monthlyFee!;
      const paid = transactions
        .filter((t) => t.kind === "income" && t.clientId === student.id && t.category === FEE_CATEGORY && (t.note?.includes(month) || t.date.startsWith(month)))
        .reduce((sum, t) => sum + t.amount, 0);
      const dueDate = feeDueDate(month, student.feeDueDay);
      const daysLate = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000));
      let status: FeeStatus;
      if (paid >= fee - 0.005) status = "paid";
      else if (paid > 0) status = "partial";
      else if (today < dueDate) status = "upcoming";
      else if (daysLate < FEE_GRACE_DAYS) status = "due";
      else status = "overdue";
      return { student, fee, paid: Math.round(paid * 100) / 100, dueDate, status, daysLate: status === "paid" ? 0 : daysLate };
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.student.name.localeCompare(b.student.name));
}
const order: Record<FeeStatus, number> = { overdue: 0, due: 1, partial: 2, upcoming: 3, paid: 4 };

/** Present (late counts as present) out of all marked days, per student. */
export function attendanceRate(entries: AttendanceEntry[]) {
  const by = new Map<string, { present: number; total: number }>();
  for (const e of entries) {
    const r = by.get(e.clientId) ?? { present: 0, total: 0 };
    r.total++;
    if (e.status !== "absent") r.present++;
    by.set(e.clientId, r);
  }
  return by;
}

/** Monday of the week containing `date`. */
export function weekStart(date: string) {
  const wd = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return addDaysISO(date, 1 - wd);
}
export function isoWeekday(date: string) {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}
