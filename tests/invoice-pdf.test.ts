import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { EMPTY_BUSINESS, type Invoice } from "@/lib/data/types";
import { pdfSafe, renderInvoicePdf } from "@/lib/invoices/pdf";
import { fmtMoney } from "@/lib/money";

const invoice: Invoice = {
  id: "00000000-0000-4000-8000-000000000001",
  clientId: null,
  projectId: null,
  number: "INV-0042",
  issueDate: "2026-10-01",
  dueDate: "2026-10-15",
  currency: "PKR",
  items: [
    { description: "Website redesign: home, about and contact pages, responsive layouts and handover", quantity: 1, rate: 120000 },
    { description: "Hosting (12 months)", quantity: 12, rate: 1500 },
  ],
  total: 138000,
  status: "sent",
  paidAt: null,
  notes: "Thank you for your business!",
  createdAt: "2026-10-01T00:00:00Z",
};

const base = {
  invoice,
  client: { name: "Ali Raza", company: "Acme Ltd", email: "ali@acme.com" },
  business: { ...EMPTY_BUSINESS, businessName: "Shayan Studio", address: "Office 4, Blue Area\nIslamabad", paymentDetails: "Meezan Bank · IBAN PK36MEZN0000000102345678 · Title: Shayan Gul" },
  senderName: "Shayan",
  senderEmail: "me@example.com",
  money: fmtMoney,
};

describe("invoice pdf", () => {
  it("builds a valid one-page PDF", async () => {
    const bytes = await renderInvoicePdf(base);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Invoice INV-0042");
    if (process.env.WRITE_PDF) writeFileSync(process.env.WRITE_PDF, bytes);
  });

  it("flows long invoices onto more pages", async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ description: `Line item ${i + 1}`, quantity: 1, rate: 100 }));
    const doc = await PDFDocument.load(await renderInvoicePdf({ ...base, invoice: { ...invoice, items, total: 8000 } }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("never breaks on characters Helvetica can't draw", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(pdfSafe("₹500 “quoted” café", font)).toBe('Rs 500 "quoted" café');
    expect(pdfSafe("علی", font)).toBe("???");
    const bytes = await renderInvoicePdf({ ...base, client: { name: "علی رضا", company: null, email: null }, invoice: { ...invoice, currency: "INR" } });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
