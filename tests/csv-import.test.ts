import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { mapClients } from "@/lib/import/clients";
import { detectDayFirst, mapHeaders, mapTransactions, parseAmount, parseDate, txKey } from "@/lib/import/transactions";

const opts: { defaultCurrency: string; defaultKind: "income" | "expense" } = { defaultCurrency: "PKR", defaultKind: "expense" };
const run = (csv: string, o: Partial<typeof opts> = {}) => mapTransactions(parseCsv(csv), { ...opts, ...o });

describe("csv", () => {
  it("handles quotes, escaped quotes, line breaks in quotes, CRLF, BOM and blank lines", () => {
    const text = '﻿Date,Note,Amount\r\n2026-10-01,"Lunch, with ""Ali""",500\r\n\r\n2026-10-02,"two\nlines",20\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Note", "Amount"],
      ["2026-10-01", 'Lunch, with "Ali"', "500"],
      ["2026-10-02", "two\nlines", "20"],
    ]);
  });
  it("detects semicolons and tabs", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("writes CSV safely, neutralising spreadsheet formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', 5, null], ["=SUM(A1)", "-3", -3]])).toBe('"a,b","say ""hi""",5,\r\n\'=SUM(A1),\'-3,-3\r\n');
  });
});

describe("csv import: pieces", () => {
  it("maps headers by name, in any order", () => {
    expect(mapHeaders(["Narration", "Txn Date", "Withdrawal", "Deposit", "Balance"])).toEqual({ note: 0, date: 1, debit: 2, credit: 3 });
    expect(mapHeaders(["Amount (PKR)", "DATE", "category"])).toEqual({ amount: 0, date: 1, category: 2 });
  });
  it("reads amounts", () => {
    expect(parseAmount("1,234.50", "PKR")).toEqual({ value: 1234.5, currency: null, drcr: null });
    expect(parseAmount("(500)", "PKR")?.value).toBe(-500);
    expect(parseAmount("-500", "PKR")?.value).toBe(-500);
    expect(parseAmount("Rs. 2,000", "PKR")).toMatchObject({ value: 2000, currency: "PKR" });
    expect(parseAmount("$12.99", "PKR")).toMatchObject({ value: 12.99, currency: "USD" });
    expect(parseAmount("500 USD", "PKR")).toMatchObject({ currency: "USD" });
    expect(parseAmount("1.234,50", "PKR")?.value).toBe(1234.5);
    expect(parseAmount("750 DR", "PKR")).toMatchObject({ value: 750, drcr: "dr" });
    expect(parseAmount("", "PKR")).toBeNull();
    expect(parseAmount("n/a", "PKR")).toBeNull();
  });
  it("reads dates and works out day/month order from the whole column", () => {
    expect(detectDayFirst(["01/02/2026", "13/02/2026"])).toBe(true);
    expect(detectDayFirst(["01/02/2026", "02/13/2026"])).toBe(false);
    expect(detectDayFirst(["01/02/2026"])).toBe(true); // no proof either way → day-first
    expect(parseDate("12/10/2026", true)).toBe("2026-10-12");
    expect(parseDate("12/10/2026", false)).toBe("2026-12-10");
    expect(parseDate("2026/10/12 14:30", true)).toBe("2026-10-12");
    expect(parseDate("12-Oct-26", true)).toBe("2026-10-12");
    expect(parseDate("Oct 12, 2026", true)).toBe("2026-10-12");
    expect(parseDate("12th October 2026", true)).toBe("2026-10-12");
    expect(parseDate("46315", true)).toBe("2026-10-20"); // Excel serial
    expect(parseDate("31/02/2026", true)).toBeNull();
    expect(parseDate("soon", true)).toBeNull();
  });
});

describe("csv import: transactions", () => {
  it("imports a simple spending list as expenses in the profile currency", () => {
    const r = run("Date,Description,Amount\n2026-10-01,Lunch at cafe,500\n2026-10-02,Uber,350");
    expect(r.error).toBeUndefined();
    expect(r.skipped).toEqual([]);
    expect(r.rows).toEqual([
      { kind: "expense", amount: 500, currency: "PKR", category: "Food", date: "2026-10-01", note: "Lunch at cafe", clientId: null, projectId: null },
      { kind: "expense", amount: 350, currency: "PKR", category: "Transport", date: "2026-10-02", note: "Uber", clientId: null, projectId: null },
    ]);
  });

  it("uses the default kind the user picked for unsigned rows", () => {
    expect(run("Date,Amount\n2026-10-01,500", { defaultKind: "income" }).rows[0].kind).toBe("income");
  });

  it("reads a signed bank export: negative is money out, positive is money in", () => {
    const r = run("Date,Details,Amount\n01/10/2026,Salary October,150000\n02/10/2026,PTCL bill,-3500");
    expect(r.rows.map((t) => [t.kind, t.amount, t.category])).toEqual([
      ["income", 150000, "Salary"],
      ["expense", 3500, "Internet & phone"],
    ]);
  });

  it("reads debit and credit columns", () => {
    const r = run("Txn Date,Narration,Withdrawal,Deposit,Balance\n05/10/2026,Rent,50000,,100000\n06/10/2026,Client payment,,80000,180000");
    expect(r.rows.map((t) => [t.kind, t.amount, t.category])).toEqual([
      ["expense", 50000, "Rent"],
      ["income", 80000, "Project payment"],
    ]);
  });

  it("keeps a type column, a known category and a currency column", () => {
    const r = run("date;type;category;amount;currency;note\n2026-10-01;income;retainer;1200;USD;Acme\n2026-10-02;expense;Groceries;40;EUR;");
    expect(r.rows.map((t) => [t.kind, t.category, t.currency, t.note])).toEqual([
      ["income", "Retainer", "USD", "Acme"],
      ["expense", "Groceries", "EUR", null],
    ]);
  });

  it("skips bad rows and says why, keeping spreadsheet line numbers", () => {
    const r = run("Date,Amount,Currency\nsoon,5,\n2026-10-01,,\n2026-10-02,10,XYZ\n2026-10-03,10,");
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toEqual([
      { line: 2, reason: 'couldn\'t read the date "soon"' },
      { line: 3, reason: "no amount" },
      { line: 4, reason: "XYZ isn't a supported currency" },
    ]);
  });

  it("explains files it can't use", () => {
    expect(run("").error).toBe("The file is empty.");
    expect(run("Amount\n5").error).toMatch(/Date/);
    expect(run("Date,Note\n2026-10-01,x").error).toMatch(/Amount/);
    expect(mapTransactions(parseCsv("Date,Amount\n" + "2026-10-01,1\n".repeat(3)), { ...opts, maxRows: 2 }).error).toMatch(/up to 2/);
  });

  it("builds the same duplicate key for the same entry", () => {
    const [a] = run("Date,Description,Amount\n2026-10-01,Lunch,500").rows;
    expect(txKey(a)).toBe(txKey({ ...a, note: "LUNCH", amount: 500.0 }));
    expect(txKey(a)).not.toBe(txKey({ ...a, amount: 501 }));
  });
});

describe("csv import: clients", () => {
  it("imports a contact list and maps status words", () => {
    const r = mapClients(parseCsv("Full Name,Company,E-mail,Mobile,Status\nAli Raza,Acme,ALI@acme.com,0300 1234567,Prospect\nMaria,,,,"), []);
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([
      { name: "Ali Raza", company: "Acme", email: "ali@acme.com", phone: "0300 1234567", status: "lead", notes: null, monthlyFee: null, feeDueDay: null, classId: null },
      { name: "Maria", company: null, email: null, phone: null, status: "active", notes: null, monthlyFee: null, feeDueDay: null, classId: null },
    ]);
  });

  it("reads a teacher's student list with parent, fee and due day", () => {
    const r = mapClients(parseCsv("Student Name,Parent,Monthly Fee,Due day\nAyesha,Imran Khan,\"5,000\",5th"), []);
    expect(r.rows[0]).toMatchObject({ name: "Ayesha", company: "Imran Khan", monthlyFee: 5000, feeDueDay: 5 });
  });

  it("skips people already added (by email, else by name) and repeats within the file", () => {
    const existing = [{ name: "Ali Raza", email: "ali@acme.com" }, { name: "Maria", email: null }];
    const r = mapClients(parseCsv("Name,Email\nAlison,ALI@ACME.COM\nmaria,\nNew Person,new@x.com\nNew Person,new@x.com"), existing);
    expect(r.rows.map((c) => c.name)).toEqual(["New Person"]);
    expect(r.duplicates).toBe(3);
  });

  it("skips bad rows with a reason and explains files it can't use", () => {
    const r = mapClients(parseCsv("Name,Email,Status,Due day\n,a@b.com,,\nBob,not-an-email,,\nCara,,maybe,\nDan,,,31"), []);
    expect(r.rows).toEqual([]);
    expect(r.skipped).toEqual([
      { line: 2, reason: "name is required" },
      { line: 3, reason: "enter a valid email" },
      { line: 4, reason: 'unknown status "maybe" (use lead, active or past)' },
      { line: 5, reason: "pick a due day from 1 to 28" },
    ]);
    expect(mapClients(parseCsv("Email\na@b.com"), []).error).toMatch(/Name/);
  });
});

describe("csv import: contact app exports", () => {
  it("reads a Google Contacts export (split name, numbered email and phone columns)", () => {
    const csv = "First Name,Middle Name,Last Name,Organization Name,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value\nSana,,Mir,Mir Studio,* Home,sana@mir.pk,Mobile,+92 333 1112223";
    expect(mapClients(parseCsv(csv), []).rows[0]).toMatchObject({ name: "Sana Mir", company: "Mir Studio", email: "sana@mir.pk", phone: "+92 333 1112223" });
  });
});
