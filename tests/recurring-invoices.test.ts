import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoRepo } from "@/lib/data/demo-repo";
import type { NewRecurringInvoice } from "@/lib/data/types";
import { materializeRecurringInvoices } from "@/lib/recurring-invoices";

async function setup(rule: Partial<NewRecurringInvoice> = {}) {
  const repo = new DemoRepo(randomUUID(), "2026-08-01", "USD");
  const client = await repo.createClient({ name: "Retainer Client", company: null, email: "retainer@client.test", phone: null, status: "active", notes: null, monthlyFee: null, feeDueDay: null, classId: null });
  const before = (await repo.listInvoices()).length;
  await repo.createRecurringInvoice({ clientId: client.id, projectId: null, currency: "USD", items: [{ description: "Monthly retainer", quantity: 1, rate: 1000 }], total: 1000, notes: null, cadence: "monthly", dueDays: 7, autoSend: false, startDate: "2026-08-31", nextDate: "2026-08-31", ...rule });
  const issued = async () => (await repo.listInvoices()).slice(0, (await repo.listInvoices()).length - before);
  return { repo, client, issued };
}

describe("repeating invoices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("issues each due date once as a draft, due N days later, keeping month-end anchors", async () => {
    const { repo, issued } = await setup();
    expect(await materializeRecurringInvoices(repo, "2026-08-30", { emailClients: false, senderName: "RK" })).toBe(0);
    expect(await materializeRecurringInvoices(repo, "2026-10-31", { emailClients: false, senderName: "RK" })).toBe(3);
    expect(await materializeRecurringInvoices(repo, "2026-10-31", { emailClients: false, senderName: "RK" })).toBe(0); // no repeats
    const invs = (await issued()).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    expect(invs.map((i) => [i.issueDate, i.dueDate, i.status, i.total])).toEqual([
      ["2026-08-31", "2026-09-07", "draft", 1000],
      ["2026-09-30", "2026-10-07", "draft", 1000],
      ["2026-10-31", "2026-11-07", "draft", 1000],
    ]);
    expect(new Set(invs.map((i) => i.number)).size).toBe(3);
    expect((await repo.listRecurringInvoices())[0].nextDate).toBe("2026-11-30");
  });

  it("leaves auto-send rules alone in runs that can't email, then emails only the latest when allowed", async () => {
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("DIGEST_FROM_EMAIL", "Dashboard <a@b.co>");
    const sent: { to: string[]; attachments?: unknown[] }[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => (sent.push(JSON.parse(String(init.body))), new Response("{}")));
    const { repo, issued } = await setup({ autoSend: true, nextDate: "2026-09-30", startDate: "2026-08-31" });

    expect(await materializeRecurringInvoices(repo, "2026-10-31", { emailClients: false, senderName: "RK" })).toBe(0);
    expect(await materializeRecurringInvoices(repo, "2026-10-31", { emailClients: true, senderName: "RK", ownerEmail: async () => "me@x.co" })).toBe(2);
    const invs = (await issued()).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    // The September catch-up stays a draft; October's (dated today) went out and is marked sent.
    expect(invs.map((i) => [i.issueDate, i.status])).toEqual([
      ["2026-09-30", "draft"],
      ["2026-10-31", "sent"],
    ]);
    expect(sent.filter((m) => m.to[0] === "retainer@client.test")).toHaveLength(1);
    expect(sent[0].attachments).toHaveLength(1);
  });

  it("stops when the schedule is deleted", async () => {
    const { repo, issued } = await setup();
    await repo.deleteRecurringInvoice((await repo.listRecurringInvoices())[0].id);
    expect(await materializeRecurringInvoices(repo, "2026-12-31", { emailClients: false, senderName: "RK" })).toBe(0);
    expect(await issued()).toHaveLength(0);
  });
});
