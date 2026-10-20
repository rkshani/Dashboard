import { describe, expect, it } from "vitest";
import type { Client, Transaction } from "@/lib/data/types";
import { attendanceRate, feeRows, weekStart, isoWeekday } from "@/lib/teaching/fees";

const student = (id: string, fee: number | null, day: number | null, status: Client["status"] = "active"): Client => ({ id, name: id, company: null, email: null, phone: null, status, notes: null, monthlyFee: fee, feeDueDay: day, classId: null, createdAt: "" });
const pay = (clientId: string, amount: number, date: string, note: string | null = null): Transaction => ({ id: date + clientId, kind: "income", amount, currency: "PKR", category: "Fees", date, note, clientId, projectId: null, invoiceId: null, createdAt: "" });

describe("fees", () => {
  it("works out paid, partial, upcoming, due and overdue", () => {
    const rows = feeRows(
      [student("a", 8000, 5), student("b", 8000, 5), student("c", 8000, 25), student("d", 8000, 18), student("e", 8000, 10), student("f", null, 5), student("g", 5000, 5, "past")],
      [pay("a", 8000, "2026-10-04"), pay("b", 3000, "2026-10-06"), pay("e", 8000, "2026-09-30", "Fee for 2026-10")],
      "2026-10",
      "2026-10-20",
    );
    const by = Object.fromEntries(rows.map((r) => [r.student.id, r.status]));
    expect(by).toEqual({ a: "paid", b: "partial", c: "upcoming", d: "due", e: "paid" });
    expect(rows.map((r) => r.student.id)).not.toContain("f");
    expect(feeRows([student("x", 100, 1)], [], "2026-10", "2026-10-20")[0]).toMatchObject({ status: "overdue", daysLate: 19 });
  });
  it("counts late as present in attendance", () => {
    const r = attendanceRate([
      { clientId: "a", date: "1", status: "present", classId: null },
      { clientId: "a", date: "2", status: "late", classId: null },
      { clientId: "a", date: "3", status: "absent", classId: null },
    ]);
    expect(r.get("a")).toEqual({ present: 2, total: 3 });
  });
  it("finds the week start and weekday", () => {
    expect(weekStart("2026-10-22")).toBe("2026-10-19"); // Thursday → Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(isoWeekday("2026-10-25")).toBe(7);
  });
});
