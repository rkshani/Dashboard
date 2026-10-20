import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/data/types";
import { parseCsv } from "@/lib/csv";
import type { Rates } from "@/lib/fx-math";
import { buildPnl, periodRange, pnlCsv, transactionsCsv } from "@/lib/reports/pnl";

const fx: Rates = { base: "USD", rates: { USD: 1, PKR: 280 }, updatedAt: null, live: true };
let n = 0;
const tx = (date: string, kind: "income" | "expense", amount: number, category: string, currency = "PKR", note: string | null = null): Transaction => ({
  id: String(++n), kind, amount, currency, category, date, note, clientId: null, projectId: null, invoiceId: null, createdAt: `${date}T00:00:00Z`,
});

describe("periods", () => {
  const today = "2026-10-20";
  it("covers whole months and years", () => {
    expect(periodRange("this-month", today, null)).toEqual({ from: "2026-10-01", to: "2026-10-31", label: "October 2026" });
    expect(periodRange("last-month", "2026-01-15", null)).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("last-month", "2026-03-31", null)).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("this-year", today, null)).toMatchObject({ from: "2026-01-01", to: "2026-12-31", label: "2026" });
    expect(periodRange("last-year", today, null)).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    expect(periodRange("last-12", today, null)).toMatchObject({ from: "2025-11-01", to: "2026-10-31", label: "November 2025 to October 2026" });
    expect(periodRange("all", today, "2024-03-05")).toMatchObject({ from: "2024-03-05", to: today });
    expect(periodRange("all", today, null)).toMatchObject({ from: "2026-10-01" });
  });
});

describe("profit and loss", () => {
  const txns = [
    tx("2026-09-03", "income", 100000, "Project payment"),
    tx("2026-10-01", "income", 200, "Retainer", "USD"), // = 56,000 PKR
    tx("2026-09-10", "expense", 3500, "Internet & phone"),
    tx("2026-10-10", "expense", 3500, "Internet & phone"),
    tx("2026-10-12", "expense", 1500, "Food"),
    tx("2026-10-13", "expense", 10, "Food", "EUR"), // no rate → left out and counted
    tx("2026-08-31", "expense", 999, "Food"), // outside the period
  ];
  const p = buildPnl(txns, { from: "2026-09-01", to: "2026-10-31", currency: "PKR", fx });

  it("groups by category and month, converts, and sorts biggest first", () => {
    expect(p.months).toEqual(["2026-09", "2026-10"]);
    expect(p.income).toEqual([
      { category: "Project payment", byMonth: [100000, 0], total: 100000 },
      { category: "Retainer", byMonth: [0, 56000], total: 56000 },
    ]);
    expect(p.expense.map((r) => [r.category, r.total])).toEqual([["Internet & phone", 7000], ["Food", 1500]]);
    expect(p.incomeTotal).toEqual([100000, 56000]);
    expect(p.expenseTotal).toEqual([3500, 5000]);
    expect(p.net).toEqual([96500, 51000]);
    expect(p.unconverted).toBe(1);
  });

  it("writes a spreadsheet-ready P&L", () => {
    const rows = parseCsv(pnlCsv(p, { label: "Sep to Oct 2026", currency: "PKR", liveRates: true, name: "Shayan Studio" }));
    expect(rows[0]).toEqual(["Profit and loss: Sep to Oct 2026"]);
    expect(rows).toContainEqual(["Category", "Sept 2026", "Oct 2026", "Total"]);
    expect(rows).toContainEqual(["Total income", "100000", "56000", "156000"]);
    expect(rows).toContainEqual(["Net profit", "96500", "51000", "147500"]);
    expect(rows.flat().join(" ")).toContain("1 entries had no exchange rate");
  });

  it("exports transactions in date order, money out as negative", () => {
    const rows = parseCsv(transactionsCsv(txns, { from: "2026-10-01", to: "2026-10-31", currency: "PKR", fx, clientName: () => undefined }));
    expect(rows[0]).toEqual(["Date", "Type", "Category", "Description", "Amount", "Currency", "Amount in PKR", "Client"]);
    expect(rows.slice(1).map((r) => [r[0], r[4], r[5], r[6]])).toEqual([
      ["2026-10-01", "200", "USD", "56000"],
      ["2026-10-10", "-3500", "PKR", "-3500"],
      ["2026-10-12", "-1500", "PKR", "-1500"],
      ["2026-10-13", "-10", "EUR", ""],
    ]);
  });
});
