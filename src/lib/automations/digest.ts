/**
 * The daily digest: pure functions (no I/O) so they can be unit-tested and previewed in the app.
 * Every value from the database or an external feed is HTML-escaped before it goes into the email.
 */
import type { CalEvent } from "@/lib/calendar/types";
import { daysBetween } from "@/lib/dates";
import type { Invoice, Project, Task } from "@/lib/data/types";
import type { FeedItem } from "@/lib/opportunities/types";

export type Digest = {
  subject: string;
  greeting: string;
  dateLabel: string;
  meetings: { time: string; title: string; location: string | null }[];
  tasks: { title: string; note: string; late: boolean }[];
  deadlines: { title: string; when: string }[];
  matches: { title: string; company: string; score: number; url: string; via: string }[];
  unpaid: { number: string; amount: string; overdue: boolean }[];
  automations: string[];
  empty: boolean;
};

export function buildDigest(input: {
  name: string;
  appName: string;
  today: string;
  dateLabel: string;
  timeOf: (e: CalEvent) => string;
  events: CalEvent[];
  tasks: Task[];
  projects: Project[];
  invoices: Invoice[];
  feed: FeedItem[];
  automations: string[];
  money: (amount: number, currency: string) => string;
  vocabulary: { project: string; opportunities: string };
}): Digest {
  const { today } = input;
  const meetings = [...input.events]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8)
    .map((e) => ({ time: input.timeOf(e), title: e.title, location: e.location }));
  const tasks = input.tasks
    .filter((t) => !t.done && t.dueDate && t.dueDate <= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || (a.priority === "high" ? -1 : 1))
    .slice(0, 10)
    .map((t) => {
      const late = t.dueDate! < today;
      const d = daysBetween(t.dueDate!, today);
      return { title: t.title, late, note: late ? `overdue ${d === 1 ? "1 day" : `${d} days`}` : t.priority === "high" ? "high priority" : "due today" };
    });
  const deadlines = input.projects
    .filter((p) => p.status !== "done" && p.deadline && daysBetween(today, p.deadline) >= 0 && daysBetween(today, p.deadline) <= 3)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .map((p) => {
      const n = daysBetween(today, p.deadline!);
      return { title: p.title, when: n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days` };
    });
  const matches = input.feed
    .filter((o) => o.status === "new" && o.score >= 60)
    .slice(0, 5)
    .map((o) => ({ title: o.title, company: o.company, score: o.score, url: o.url, via: o.attribution.name }));
  const unpaid = input.invoices
    .filter((i) => i.status === "sent")
    .map((i) => ({ number: i.number, amount: input.money(i.total, i.currency), overdue: Boolean(i.dueDate && i.dueDate < today) }));

  const parts: string[] = [];
  if (meetings.length) parts.push(`${meetings.length} meeting${meetings.length > 1 ? "s" : ""}`);
  if (tasks.length) parts.push(`${tasks.length} task${tasks.length > 1 ? "s" : ""}`);
  if (matches.length) parts.push(`${matches.length} new match${matches.length > 1 ? "es" : ""}`);
  const empty = !meetings.length && !tasks.length && !deadlines.length && !matches.length && !unpaid.length;

  return {
    subject: empty ? `${input.appName}: a clear day` : `${input.appName}: ${parts.join(", ") || "your day"}`,
    greeting: `Good morning, ${input.name}`,
    dateLabel: input.dateLabel,
    meetings,
    tasks,
    deadlines,
    matches,
    unpaid,
    automations: input.automations.slice(0, 6),
    empty,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");

/** Email-client-safe HTML: tables and inline styles, light colours. */
export function renderDigestHtml(d: Digest, appUrl: string, appName: string): string {
  const section = (title: string, rows: string) =>
    `<tr><td style="padding:20px 0 6px;font:600 15px/1.4 Arial,sans-serif;color:#111827">${esc(title)}</td></tr><tr><td>${rows}</td></tr>`;
  const row = (left: string, right: string, sub = "") =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #eef0f4"><tr><td style="padding:9px 0;font:14px/1.4 Arial,sans-serif;color:#111827">${left}${sub ? `<div style="font-size:12px;color:#6b7280">${sub}</div>` : ""}</td><td align="right" style="padding:9px 0;font:12px/1.4 Arial,sans-serif;color:#6b7280;white-space:nowrap">${right}</td></tr></table>`;

  let body = "";
  if (d.empty) body += `<tr><td style="padding:16px 0;font:14px/1.6 Arial,sans-serif;color:#374151">Nothing due, no meetings and no new matches. Enjoy a clear day.</td></tr>`;
  if (d.meetings.length) body += section("Meetings", d.meetings.map((m) => row(esc(m.title), esc(m.time), m.location ? esc(m.location) : "")).join(""));
  if (d.tasks.length) body += section("Tasks", d.tasks.map((t) => row(esc(t.title), `<span style="color:${t.late ? "#b45309" : "#6b7280"}">${esc(t.note)}</span>`)).join(""));
  if (d.deadlines.length) body += section("Deadlines coming up", d.deadlines.map((p) => row(esc(p.title), esc(p.when))).join(""));
  if (d.matches.length)
    body += section(
      "New matches",
      d.matches.map((m) => row(`<a href="${safeHref(m.url)}" style="color:#1d4ed8;text-decoration:none">${esc(m.title)}</a>`, `score ${m.score}`, `${esc(m.company)} · via ${esc(m.via)}`)).join(""),
    );
  if (d.unpaid.length) body += section("Unpaid invoices", d.unpaid.map((u) => row(esc(u.number), `<span style="color:${u.overdue ? "#b45309" : "#6b7280"}">${esc(u.amount)}${u.overdue ? " · overdue" : ""}</span>`)).join(""));
  if (d.automations.length) body += section("Done for you overnight", d.automations.map((a) => row(esc(a), "")).join(""));

  return `<!doctype html><html><body style="margin:0;background:#f4f6fa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font:700 13px/1 Arial,sans-serif;color:#2f5bea;letter-spacing:.04em">${esc(appName.toUpperCase())}</td></tr>
<tr><td style="padding-top:14px;font:700 22px/1.3 Arial,sans-serif;color:#111827">${esc(d.greeting)}</td></tr>
<tr><td style="padding-top:4px;font:14px/1.4 Arial,sans-serif;color:#6b7280">${esc(d.dateLabel)}</td></tr>
${body}
<tr><td style="padding-top:24px"><a href="${safeHref(appUrl)}/app" style="display:inline-block;background:#2f5bea;color:#ffffff;font:600 14px Arial,sans-serif;padding:12px 18px;border-radius:10px;text-decoration:none">Open your dashboard</a></td></tr>
<tr><td style="padding-top:20px;font:12px/1.5 Arial,sans-serif;color:#9ca3af">You get this because the daily digest is on. Change the time or turn it off in <a href="${safeHref(appUrl)}/app/automations" style="color:#6b7280">Automations</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderDigestText(d: Digest, appUrl: string): string {
  const lines = [d.greeting, d.dateLabel, ""];
  const block = (t: string, items: string[]) => items.length && lines.push(t.toUpperCase(), ...items.map((i) => `- ${i}`), "");
  if (d.empty) lines.push("Nothing due, no meetings and no new matches.", "");
  block("Meetings", d.meetings.map((m) => `${m.time} ${m.title}`));
  block("Tasks", d.tasks.map((t) => `${t.title} (${t.note})`));
  block("Deadlines", d.deadlines.map((p) => `${p.title}: ${p.when}`));
  block("New matches", d.matches.map((m) => `${m.title}, ${m.company} (score ${m.score}) ${m.url}`));
  block("Unpaid invoices", d.unpaid.map((u) => `${u.number} ${u.amount}${u.overdue ? " overdue" : ""}`));
  block("Done for you", d.automations);
  lines.push(`Open your dashboard: ${appUrl}/app`, `Turn this off: ${appUrl}/app/automations`);
  return lines.join("\n");
}
