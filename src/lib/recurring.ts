import "server-only";
import type { Repo } from "@/lib/data/repo";
import { fmtMoney } from "@/lib/money";
import { dueOccurrences } from "@/lib/recurrence";
import { notify } from "@/lib/notifications/notify";

/**
 * Adds every due occurrence of the user's repeating income and expenses up to today.
 * Safe to call often and from overlapping requests: each (rule, date) is claimed in the
 * automation log first, which is unique, so an entry is never added twice.
 */
export async function materializeRecurring(repo: Repo, today: string, notifyUser = true) {
  const rules = await repo.listRecurring();
  let added = 0;
  for (const r of rules) {
    if (r.nextDate > today) continue;
    const { dates, next } = dueOccurrences(r.cadence, r.nextDate, r.startDate, today);
    for (const date of dates) {
      const label = `${r.kind === "income" ? "Added repeating income" : "Added repeating expense"}: ${r.note || r.category}, ${fmtMoney(r.amount, r.currency)}`;
      if (!(await repo.logAutomation("recurring", `${r.id}:${date}`, label))) continue;
      await repo.createTransaction({ kind: r.kind, amount: r.amount, currency: r.currency, category: r.category, date, note: r.note, clientId: r.clientId, projectId: r.projectId });
      added++;
    }
    await repo.setRecurringNext(r.id, next);
  }
  if (added && notifyUser) await notify(repo, { kind: "money", title: added === 1 ? "Added 1 repeating entry" : `Added ${added} repeating entries`, body: "Your repeating income and expenses are up to date.", href: "/app/finance" });
  return added;
}
