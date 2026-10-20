import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAutomations } from "@/lib/automations/engine";
import { DemoRepo } from "@/lib/data/demo-repo";
import { reminderMessage, reminderStage } from "@/lib/invoices/reminders";
import type { Profile } from "@/lib/profile";
import { getTemplate } from "@/templates";

describe("payment reminder schedule", () => {
  it("sends on days 1, 7 and 14 after the due date, then stops", () => {
    const due = "2026-10-01";
    expect(reminderStage(due, "2026-10-01")).toBe(0);
    expect(reminderStage(due, "2026-10-02")).toBe(1);
    expect(reminderStage(due, "2026-10-07")).toBe(1);
    expect(reminderStage(due, "2026-10-08")).toBe(2);
    expect(reminderStage(due, "2026-10-15")).toBe(3);
    expect(reminderStage(due, "2026-10-30")).toBe(3);
    expect(reminderStage(due, "2026-10-31")).toBe(0); // a month late: stop emailing
  });

  it("words each stage politely and correctly", () => {
    const o = { clientName: "Ali Raza", number: "INV-0007", amount: "PKR 50,000", from: "Shayan Studio" };
    expect(reminderMessage(1, { ...o, daysLate: 1 })).toContain("Hi Ali,");
    expect(reminderMessage(1, { ...o, daysLate: 1 })).toContain("was due yesterday");
    expect(reminderMessage(1, { ...o, daysLate: 3 })).toContain("was due 3 days ago");
    expect(reminderMessage(2, { ...o, daysLate: 7 })).toContain("7 days overdue");
    expect(reminderMessage(3, { ...o, clientName: null, daysLate: 14 })).toMatch(/^Hi,\n/);
  });
});

describe("payment reminder automation", () => {
  const profile: Profile = { displayName: "RK", templateId: "software-engineer", skills: [], workTypes: [], rateMin: null, rateMax: null, currency: "USD", remotePref: "remote", regions: [], timezone: "UTC", theme: "midnight" };
  const template = getTemplate("software-engineer");
  const only = { "invoice-reminder-email": true, "invoice-overdue": false, "high-match-task": false, "deadline-warning": false };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function setup() {
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("DIGEST_FROM_EMAIL", "Dashboard <a@b.co>");
    const sent: { to: string[]; subject: string; attachments?: { filename: string }[] }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    });
    const repo = new DemoRepo(randomUUID(), "2026-10-01", "USD");
    const client = await repo.createClient({ name: "Zara Unique", company: null, email: "zara@unique.test", phone: null, status: "active", notes: null, monthlyFee: null, feeDueDay: null, classId: null });
    const inv = await repo.createInvoice({ clientId: client.id, projectId: null, issueDate: "2026-09-20", dueDate: "2026-10-01", notes: null, items: [{ description: "Work", quantity: 1, rate: 500 }], currency: "USD", total: 500 });
    await repo.setInvoiceStatus(inv.id, "sent", "2026-09-20");
    const toZara = () => sent.filter((m) => m.to[0] === "zara@unique.test");
    return { repo, inv, toZara };
  }

  it("is off by default", async () => {
    const { repo, toZara } = await setup();
    await repo.saveAutomationSettings({ rules: { "invoice-overdue": false, "high-match-task": false } });
    await runAutomations({ repo, profile, template, today: "2026-10-02", emailClients: true, ownerEmail: async () => "me@x.co" });
    expect(toZara()).toHaveLength(0);
  });

  it("emails each stage once, with the PDF, and never in demo/manual runs that disallow it", async () => {
    const { repo, inv, toZara } = await setup();
    await repo.saveAutomationSettings({ rules: only });

    await runAutomations({ repo, profile, template, today: "2026-10-02", emailClients: false });
    expect(toZara()).toHaveLength(0); // client emails not allowed for this run

    const run = (today: string) => runAutomations({ repo, profile, template, today, emailClients: true, ownerEmail: async () => "me@x.co" });
    await run("2026-10-02");
    await run("2026-10-02"); // hourly re-run: no repeat
    expect(toZara()).toHaveLength(1);
    expect(toZara()[0].subject).toBe(`Reminder: invoice ${inv.number} from RK`);
    expect(toZara()[0].attachments?.[0].filename).toBe(`${inv.number}.pdf`);

    await run("2026-10-08");
    await run("2026-10-20"); // skipped ahead past day 14: sends stage 3 only
    await run("2026-10-21");
    expect(toZara().map((m) => m.subject.split(":")[0])).toEqual(["Reminder", "Overdue", "Overdue"]);

    await repo.setInvoiceStatus(inv.id, "paid", "2026-10-22");
    await run("2026-10-22");
    expect(toZara()).toHaveLength(3);
  });
});
