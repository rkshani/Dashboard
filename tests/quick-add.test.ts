import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/quick-add";

const TODAY = "2026-10-20"; // a Tuesday
const parse = (s: string, cur = "USD") => {
  const r = parseQuickAdd(s, TODAY, cur);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("quick add", () => {
  it("reads the example from the guide", () => {
    expect(parse("Lunch 500 PKR yesterday")).toEqual({ kind: "expense", amount: 500, currency: "PKR", category: "Food", date: "2026-10-19", note: "Lunch" });
  });

  it("defaults to an expense today in the profile currency", () => {
    expect(parse("Uber 12", "EUR")).toMatchObject({ kind: "expense", amount: 12, currency: "EUR", category: "Transport", date: TODAY, note: "Uber" });
  });

  it("understands currency symbols, codes and rupees", () => {
    expect(parse("$20 domain")).toMatchObject({ currency: "USD", amount: 20, category: "Software" });
    expect(parse("Rs.1,500 petrol")).toMatchObject({ currency: "PKR", amount: 1500, category: "Transport" });
    expect(parse("Rs 1500 petrol", "INR")).toMatchObject({ currency: "INR" });
    expect(parse("internet 2500/- ")).toMatchObject({ amount: 2500, category: "Internet & phone" });
    expect(parse("coffee 450pkr")).toMatchObject({ currency: "PKR", amount: 450 });
    expect(parse("PKR 900 chai")).toMatchObject({ currency: "PKR", amount: 900, note: "Chai" });
    expect(parse("lunch 500 yesterday aed")).toMatchObject({ currency: "AED", date: "2026-10-19" });
    expect(parse("hosting 30 euros")).toMatchObject({ currency: "EUR" });
  });

  it("understands k and lakh", () => {
    expect(parse("laptop 1.5k")).toMatchObject({ amount: 1500, category: "Hardware" });
    expect(parse("rent 2 lakh")).toMatchObject({ amount: 200_000, category: "Rent", note: "Rent" });
    expect(parse("rent 2lakh")).toMatchObject({ amount: 200_000 });
    expect(parse("salary 5 thousand pkr received")).toMatchObject({ amount: 5000, currency: "PKR", kind: "income" });
    expect(parse("fuel 3 hazar")).toMatchObject({ amount: 3000 });
    expect(parse("ads 12.345")).toMatchObject({ amount: 12.35 });
  });

  it("spots income", () => {
    expect(parse("+50000 salary")).toMatchObject({ kind: "income", category: "Salary", amount: 50000 });
    expect(parse("Received 80000 from Ali for website")).toMatchObject({ kind: "income", category: "Other income", note: "Ali for website" });
    expect(parse("got 300 usd from client")).toMatchObject({ kind: "income", category: "Project payment" });
    expect(parse("fees received 5000 from Sara")).toMatchObject({ kind: "income", category: "Fees" });
    expect(parse("paid by Acme 1200 for invoice")).toMatchObject({ kind: "income", category: "Project payment" });
    // Paying someone's salary is still an expense.
    expect(parse("paid salary to helper 20000")).toMatchObject({ kind: "expense" });
    expect(parse("-40 refund fee")).toMatchObject({ kind: "expense" });
  });

  it("reads dates", () => {
    expect(parse("lunch 500 3 days ago").date).toBe("2026-10-17");
    expect(parse("lunch 500 last monday").date).toBe("2026-10-19");
    expect(parse("lunch 500 last tuesday").date).toBe("2026-10-13");
    expect(parse("lunch 500 tuesday").date).toBe(TODAY);
    expect(parse("lunch 500 friday").date).toBe("2026-10-16");
    expect(parse("rent 50000 1 oct").date).toBe("2026-10-01");
    expect(parse("rent 50000 oct 1st").date).toBe("2026-10-01");
    expect(parse("dinner 900 25 dec").date).toBe("2025-12-25"); // no year and in the future → last year
    expect(parse("dinner 900 25 dec 2026").date).toBe("2026-12-25");
    expect(parse("tax 100 2026-04-30").date).toBe("2026-04-30");
    expect(parse("lunch 500 aaj").date).toBe(TODAY);
    expect(parse("31 feb lunch 500").date).toBe(TODAY); // not a real date, so it stays in the note
  });

  it("writes a tidy note", () => {
    expect(parse("Spent 500 on lunch")).toMatchObject({ note: "Lunch", category: "Food" });
    expect(parse("500")).toMatchObject({ note: null, category: "Other" });
    expect(parse("bought new keyboard for 45 usd")).toMatchObject({ note: "New keyboard", category: "Hardware" });
  });

  it("explains what's missing", () => {
    expect(parseQuickAdd("lunch yesterday", TODAY, "USD")).toEqual({ ok: false, error: 'Add an amount, like "Lunch 500".' });
    expect(parseQuickAdd("   ", TODAY, "USD").ok).toBe(false);
  });
});
