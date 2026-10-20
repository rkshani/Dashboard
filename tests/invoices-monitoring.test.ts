import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInvoiceEmail } from "@/lib/invoices/email";
import { EMPTY_BUSINESS, type Invoice } from "@/lib/data/types";

const inv: Invoice = {
  id: "11111111-1111-1111-1111-111111111111",
  clientId: "c",
  projectId: null,
  number: "INV-0007",
  issueDate: "2026-10-20",
  dueDate: "2026-11-03",
  currency: "USD",
  items: [
    { description: "API work <script>alert(1)</script>", quantity: 8, rate: 25 },
    { description: "Deployment", quantity: 1, rate: 100 },
  ],
  total: 300,
  status: "draft",
  paidAt: null,
  notes: "Thanks!",
  createdAt: "",
};
const money = (a: number, c: string) => `${c} ${a}`;

describe("invoice email", () => {
  it("escapes client-provided text and includes totals and payment details", () => {
    const { subject, html, text } = renderInvoiceEmail({
      invoice: inv,
      client: { name: 'Bilal "<b>"', company: null },
      business: { ...EMPTY_BUSINESS, businessName: "RK Apps", paymentDetails: "IBAN PK00 0000\nPayoneer: rk@example.com" },
      senderName: "RK",
      money,
      message: "Hi <i>Bilal</i>",
    });
    expect(subject).toBe("Invoice INV-0007 from RK Apps: USD 300, due 3 November 2026");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<i>Bilal</i>");
    expect(html).toContain("Bilal &quot;&lt;b&gt;&quot;");
    expect(html).toContain("IBAN PK00 0000<br>Payoneer");
    expect(html).toContain("USD 300");
    expect(text).toContain("Total: USD 300");
    expect(text).toContain("How to pay:");
  });
  it("falls back to your name and 'on receipt' when details are missing", () => {
    const { subject } = renderInvoiceEmail({ invoice: { ...inv, dueDate: null }, client: null, business: EMPTY_BUSINESS, senderName: "RK", money });
    expect(subject).toBe("Invoice INV-0007 from RK: USD 300, due on receipt");
  });
});

describe("error alerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ALERT_WEBHOOK_URL;
  });
  it("scrubs ids and query strings and throttles repeats", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/x";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { reportError } = await import("@/lib/monitoring");
    const path = "/app/invoice/11111111-2222-3333-4444-555555555555?token=secret";
    await reportError({ source: "server:render", message: "boom", path });
    await reportError({ source: "server:render", message: "boom", path });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain("/app/invoice/:id");
    expect(body).not.toContain("secret");
  });
  it("only logs when no webhook is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { reportError } = await import("@/lib/monitoring");
    await reportError({ source: "client", message: "other error" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});
