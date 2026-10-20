import "server-only";
import type { Repo } from "@/lib/data/repo";
import type { BusinessProfile, Client } from "@/lib/data/types";
import { addDays, daysBetween } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { emailInvoice } from "@/lib/invoices/send";
import { fmtMoney } from "@/lib/money";
import { notify } from "@/lib/notifications/notify";
import { dueOccurrences } from "@/lib/recurrence";

/**
 * Issues every due occurrence of the user's repeating invoices, up to today. Like repeating
 * transactions, each (rule, date) is claimed in the automation log first, so overlapping runs
 * never create the same invoice twice.
 *
 * Auto-send rules email the new invoice to the client, but only from runs allowed to email clients
 * (the scheduled job and "Run now", never demo), and only the latest occurrence if it's recent. A
 * catch-up backlog stays as drafts for the user to check, so a client never gets a pile at once.
 */
export async function materializeRecurringInvoices(
  repo: Repo,
  today: string,
  o: { emailClients: boolean; senderName: string; ownerEmail?: () => Promise<string | null>; notifyUser?: boolean },
): Promise<number> {
  const rules = (await repo.listRecurringInvoices()).filter((r) => r.nextDate <= today);
  if (!rules.length) return 0;
  const canSend = o.emailClients && emailConfigured();
  let clients: Client[] | null = null;
  let business: BusinessProfile | null = null;
  let created = 0;

  for (const r of rules) {
    // Leave auto-send rules for a run that can email, rather than issuing them unsent.
    if (r.autoSend && !canSend) continue;
    clients ??= await repo.listClients();
    const client = r.clientId ? clients.find((c) => c.id === r.clientId) : undefined;
    const { dates, next } = dueOccurrences(r.cadence, r.nextDate, r.startDate, today, 12);
    for (const date of dates) {
      const label = `Issued a repeating invoice${client ? ` for ${client.name}` : ""}: ${fmtMoney(r.total, r.currency)}, dated ${date}`;
      if (!(await repo.logAutomation("recurring-invoice", `${r.id}:${date}`, label))) continue;
      const inv = await repo.createInvoice({ clientId: r.clientId, projectId: r.projectId, issueDate: date, dueDate: addDays(date, r.dueDays), notes: r.notes, items: r.items, currency: r.currency, total: r.total });
      created++;
      const latest = date === dates[dates.length - 1] && daysBetween(date, today) <= 3;
      if (!(r.autoSend && latest && client?.email)) continue;
      try {
        business ??= await repo.getBusinessProfile();
        const replyTo = business.contactEmail ?? (await o.ownerEmail?.()) ?? null;
        if (!replyTo) throw new Error("No reply-to address");
        await emailInvoice({ invoice: inv, client, business, senderName: o.senderName, replyTo });
        await repo.setInvoiceStatus(inv.id, "sent", today);
        await notify(repo, { kind: "invoice", title: `${inv.number} sent to ${client.name}`, body: `Your repeating invoice for ${fmtMoney(inv.total, inv.currency)} was emailed automatically.`, href: `/app/invoice/${inv.id}` });
      } catch (e) {
        console.error("[recurring-invoices] send failed:", e instanceof Error ? e.message : e);
        await notify(repo, { kind: "invoice", title: `Couldn't email ${inv.number}`, body: `It was created as a draft. Check ${client.name}'s email address and send it from the invoice page.`, href: `/app/invoice/${inv.id}` });
      }
    }
    await repo.setRecurringInvoiceNext(r.id, next);
  }
  if (created && o.notifyUser !== false) {
    await notify(repo, { kind: "invoice", title: created === 1 ? "1 repeating invoice issued" : `${created} repeating invoices issued`, body: "Drafts are waiting for you to check and send; auto-send ones went out already.", href: "/app/invoices" });
  }
  return created;
}
