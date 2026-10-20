import { describe, expect, it } from "vitest";
import { addMonthsISO, dueOccurrences, nextMoneyDate, nextTaskDate } from "@/lib/recurrence";

describe("recurrence", () => {
  it("clamps month ends and keeps the anchor day", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonthsISO("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsISO("2028-01-29", 1)).toBe("2028-02-29");
  });
  it("moves repeating tasks to the next future date", () => {
    expect(nextTaskDate("daily", "2026-10-20", "2026-10-20")).toBe("2026-10-21");
    expect(nextTaskDate("weekly", "2026-10-01", "2026-10-20")).toBe("2026-10-22");
    expect(nextTaskDate("weekdays", "2026-10-23", "2026-10-23")).toBe("2026-10-26"); // Friday → Monday
    expect(nextTaskDate("monthly", "2026-01-31", "2026-02-01")).toBe("2026-02-28");
    expect(nextTaskDate("daily", null, "2026-10-20")).toBe("2026-10-21");
    expect(nextTaskDate("none", "2026-10-20", "2026-10-20")).toBeNull();
  });
  it("lists every missed money occurrence, with a cap", () => {
    const r = dueOccurrences("monthly", "2026-08-31", "2026-05-31", "2026-10-31");
    expect(r.dates).toEqual(["2026-08-31", "2026-09-30", "2026-10-31"]);
    expect(r.next).toBe("2026-11-30");
    expect(dueOccurrences("weekly", "2020-01-01", "2020-01-01", "2026-10-20").dates).toHaveLength(24);
    expect(dueOccurrences("yearly", "2027-01-01", "2026-01-01", "2026-10-20").dates).toEqual([]);
    expect(nextMoneyDate("yearly", "2028-02-29", "2028-02-29")).toBe("2029-02-28");
  });
});
