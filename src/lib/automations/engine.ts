import "server-only";
import type { Repo } from "@/lib/data/repo";
import { daysBetween } from "@/lib/dates";
import { getFeed } from "@/lib/opportunities/feed";
import type { Profile } from "@/lib/profile";
import type { Template } from "@/templates";
import type { AutomationSettings } from "./types";
import { notify } from "@/lib/notifications/notify";

export function ruleEnabled(template: Template, settings: AutomationSettings, id: string) {
  const def = template.automations.find((a) => a.id === id);
  if (!def) return false;
  return settings.rules[id] ?? def.enabledByDefault;
}

export type RunResult = { ruleId: string; message: string }[];

/**
 * Runs the task-creating rules once. Every action is recorded in the automation log under a
 * unique (rule, key), so running this every hour never creates duplicates.
 */
export async function runAutomations(ctx: { repo: Repo; profile: Profile; template: Template; today: string }): Promise<RunResult> {
  const { repo, profile, template, today } = ctx;
  const settings = await repo.getAutomationSettings();
  const on = (id: string) => ruleEnabled(template, settings, id);
  const done: RunResult = [];
  const v = template.vocabulary;

  // 1. Strong new matches → save to pipeline + review task.
  if (on("high-match-task")) {
    const feed = await getFeed(repo, profile);
    for (const o of feed.filter((x) => x.status === "new" && x.score >= 85).slice(0, 5)) {
      const message = `Saved "${o.title}" (${o.company}, score ${o.score}) and added a review task`;
      if (await repo.logAutomation("high-match-task", o.id, message)) {
        await repo.setOpportunityStatus(o.id, "saved");
        await repo.createTask({ title: `Review ${v.opportunity.toLowerCase()}: ${o.title}`.slice(0, 200), projectId: null, dueDate: today, priority: "high" });
        done.push({ ruleId: "high-match-task", message });
        await notify(repo, { kind: "match", title: `Strong match: ${o.title}`, body: `${o.company} · score ${o.score}. Saved to your pipeline.`, href: "/app/opportunities?tab=pipeline" });
      }
    }
  }

  // 2. Deadlines in the next 2 days → one reminder task per project per deadline.
  if (on("deadline-warning")) {
    for (const p of (await repo.listProjects()).filter((x) => x.status !== "done" && x.deadline)) {
      const left = daysBetween(today, p.deadline!);
      if (left < 0 || left > 2) continue;
      const when = left === 0 ? "today" : left === 1 ? "tomorrow" : "in 2 days";
      const message = `"${p.title}" is due ${when}: added a reminder task`;
      if (await repo.logAutomation("deadline-warning", `${p.id}:${p.deadline}`, message)) {
        await repo.createTask({ title: `${v.project} due ${when}: ${p.title}`.slice(0, 200), projectId: p.id, dueDate: today, priority: "high" });
        done.push({ ruleId: "deadline-warning", message });
        await notify(repo, { kind: "deadline", title: `${p.title} is due ${when}`, body: "A reminder task was added for today.", href: `/app/project/${p.id}` });
      }
    }
  }

  // 3. Unpaid invoices past their due date → chase task.
  if (on("invoice-overdue")) {
    const clients = new Map((await repo.listClients()).map((c) => [c.id, c.name]));
    for (const inv of (await repo.listInvoices()).filter((i) => i.status === "sent" && i.dueDate && i.dueDate < today)) {
      const who = inv.clientId ? clients.get(inv.clientId) : null;
      const message = `${inv.number} is overdue${who ? ` (${who})` : ""}: added a reminder to chase payment`;
      if (await repo.logAutomation("invoice-overdue", `${inv.id}:${inv.dueDate}`, message)) {
        await repo.createTask({ title: `Chase payment: ${inv.number}${who ? ` (${who})` : ""}`.slice(0, 200), projectId: inv.projectId, dueDate: today, priority: "high" });
        done.push({ ruleId: "invoice-overdue", message });
        await notify(repo, { kind: "invoice", title: `${inv.number} is overdue`, body: who ? `${who} hasn't paid yet. A chase task was added.` : "A chase task was added.", href: `/app/invoice/${inv.id}` });
      }
    }
  }

  return done;
}
