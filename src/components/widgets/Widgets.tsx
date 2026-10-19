import Link from "next/link";
import type { ReactNode } from "react";
import type { Profile } from "@/lib/profile";
import type { Template } from "@/templates";
import type { WidgetType } from "@/templates/types";
import type { Client, Project, Task } from "@/lib/data/types";
import { daysBetween, relativeDay } from "@/lib/dates";
import { sampleMoney, sampleOpportunities } from "./sample-data";

type WidgetConfig = Template["widgets"][number];
const lower = (s: string) => (/^\d/.test(s) ? s : s[0].toLowerCase() + s.slice(1));
export type WorkData = { clients: Client[]; projects: Project[]; tasks: Task[]; today: string };
type WidgetProps = { template: Template; profile: Profile; widget: WidgetConfig; data: WorkData };

const spanClass = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

function Card({ title, href, children, span, delay, sample = true }: { title: string; href?: string; children: ReactNode; span: 1 | 2 | 3; delay: number; sample?: boolean }) {
  return (
    <section
      aria-label={title}
      className={`lift anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 ${spanClass[span]} ${span > 1 ? "md:col-span-2" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          {sample && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">Sample</span>}
          {href && (
            <Link href={href} className="text-sm text-accent hover:underline">
              View all
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Kpis({ template, data }: WidgetProps) {
  const v = template.vocabulary;
  const open = data.tasks.filter((t) => !t.done);
  const dueToday = open.filter((t) => t.dueDate === data.today).length;
  const overdue = open.filter((t) => t.dueDate && t.dueDate < data.today).length;
  const activeProjects = data.projects.filter((p) => p.status === "active" || p.status === "review").length;
  const dueSoon = data.projects.filter((p) => p.status !== "done" && p.deadline && daysBetween(data.today, p.deadline) <= 7 && daysBetween(data.today, p.deadline) >= 0).length;
  const activeClients = data.clients.filter((c) => c.status === "active").length;
  const leads = data.clients.filter((c) => c.status === "lead").length;
  const items = [
    { label: "Due today", value: String(dueToday), note: overdue ? `${overdue} overdue` : "nothing overdue", tone: overdue ? "text-warn" : "text-good" },
    { label: `Active ${v.projects.toLowerCase()}`, value: String(activeProjects), note: dueSoon ? `${dueSoon} due this week` : "no deadlines this week", tone: dueSoon ? "text-accent" : "text-muted" },
    { label: `Active ${v.clients.toLowerCase()}`, value: String(activeClients), note: leads ? `${leads} ${leads === 1 ? "lead" : "leads"} in the pipeline` : "no open leads", tone: "text-muted" },
    { label: `New ${v.opportunities.toLowerCase()}`, value: "12", note: "sample · feed coming soon", tone: "text-muted" },
  ];
  return (
    <div className="anim-rise grid grid-cols-2 gap-3 md:col-span-2 lg:col-span-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="lift rounded-2xl border border-line bg-surface p-4">
          <div className="text-sm text-muted">{k.label}</div>
          <div className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{k.value}</div>
          <div className={`mt-1 text-xs ${k.tone}`}>{k.note}</div>
        </div>
      ))}
    </div>
  );
}

function Opportunities({ template, profile, widget }: WidgetProps) {
  const opps = sampleOpportunities(template, profile, widget.limit ?? 4);
  return (
    <Card title={widget.title ?? `New ${template.vocabulary.opportunities.toLowerCase()}`} href="/app/opportunities" span={widget.span} delay={80}>
      <p className="-mt-2 mb-3 flex items-center gap-2 text-xs text-muted">
        <span className="anim-pulse h-2 w-2 rounded-full bg-good" aria-hidden="true" />
        Matched to {profile.skills.slice(0, 3).join(", ") || "your profile"}
      </p>
      <ul className="flex flex-col gap-1">
        {opps.map((o, i) => (
          <li key={o.id} className="anim-rise flex flex-wrap items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-2" style={{ animationDelay: `${150 + i * 70}ms` }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 font-mono text-sm text-accent" aria-label={`Match score ${o.score}`}>
              {o.score}
            </span>
            <span className="min-w-0 flex-[1_1_200px]">
              <span className="block truncate text-sm font-semibold">{o.title}</span>
              <span className="block text-xs text-muted">{o.meta}</span>
              <span className="mt-1.5 block h-1 max-w-60 overflow-hidden rounded bg-surface-2">
                <span className="anim-fill block h-1 rounded bg-accent" style={{ width: `${o.score}%` }} />
              </span>
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{o.kind}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Today({ widget, data }: WidgetProps) {
  const projectTitle = new Map(data.projects.map((p) => [p.id, p.title]));
  const items = data.tasks
    .filter((t) => !t.done && t.dueDate && t.dueDate <= data.today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);
  return (
    <Card title={widget.title ?? "Today"} href="/app/tasks" span={widget.span} delay={120} sample={false}>
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Nothing due today. <Link href="/app/tasks" className="text-accent hover:underline">Add a task</Link></p>
      ) : (
        <ul className="flex flex-col">
          {items.map((t) => {
            const late = t.dueDate! < data.today;
            return (
              <li key={t.id} className="flex gap-3 rounded-lg px-1 py-2.5">
                <span className={`w-0.5 shrink-0 rounded ${late ? "bg-warn" : t.priority === "high" ? "bg-accent" : "bg-line"}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className={`block truncate text-xs ${late ? "text-warn" : "text-muted"}`}>
                    {[late ? `Overdue · ${relativeDay(t.dueDate!, data.today)}` : "Today", t.projectId ? projectTitle.get(t.projectId) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Money({ widget, template }: WidgetProps) {
  return (
    <Card title={widget.title ?? "Money"} href={template.modules.some((m) => m.id === "finance") ? "/app/finance" : undefined} span={widget.span} delay={160}>
      <div className="flex h-36 items-end gap-2" role="img" aria-label="Income and expenses over the last six months (sample)">
        {sampleMoney.map((b, i) => (
          <div key={b.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-28 w-full items-end gap-1">
              <span className="anim-grow block flex-1 rounded-t-md bg-accent" style={{ height: `${b.inc}%`, animationDelay: `${300 + i * 60}ms` }} />
              <span className="anim-grow block flex-1 rounded-t-md bg-line" style={{ height: `${b.exp}%`, animationDelay: `${330 + i * 60}ms` }} />
            </div>
            <span className="text-[11px] text-muted">{b.m}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-line" />Expenses</span>
      </div>
    </Card>
  );
}

function Projects({ template, widget, data }: WidgetProps) {
  const v = template.vocabulary;
  const clientName = new Map(data.clients.map((c) => [c.id, c.name]));
  const items = data.projects
    .filter((p) => p.status !== "done")
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, 4)
    .map((p) => {
      const ts = data.tasks.filter((t) => t.projectId === p.id);
      const pct = ts.length ? Math.round((ts.filter((t) => t.done).length / ts.length) * 100) : 0;
      const late = p.deadline && p.deadline < data.today;
      return {
        id: p.id,
        name: p.title,
        meta: [p.clientId ? clientName.get(p.clientId) : null, p.deadline ? `${late ? "overdue" : "due"} ${lower(relativeDay(p.deadline, data.today))}` : "no deadline"].filter(Boolean).join(" · "),
        pct,
        tone: late ? "bg-warn" : "bg-accent",
      };
    });
  return (
    <Card title={widget.title ?? `Active ${v.projects.toLowerCase()}`} href="/app/projects" span={widget.span} delay={200} sample={false}>
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">No open {v.projects.toLowerCase()}. <Link href="/app/projects" className="text-accent hover:underline">Add one</Link></p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((p) => (
            <li key={p.id}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className="font-mono text-xs text-muted">{p.pct}%</span>
              </div>
              <div className="truncate text-xs text-muted">{p.meta}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={`anim-fill h-1.5 rounded-full ${p.tone}`} style={{ width: `${p.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Pipeline({ widget }: WidgetProps) {
  const stages = [
    { n: 12, label: "New" },
    { n: 5, label: "Contacted" },
    { n: 3, label: "Proposal" },
    { n: 2, label: "Won" },
  ];
  return (
    <Card title={widget.title ?? "Pipeline"} href="/app/opportunities" span={widget.span} delay={240}>
      <div className="grid grid-cols-2 gap-2">
        {stages.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 p-3 text-center">
            <div className="font-display text-2xl font-semibold">{s.n}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AutomationLog({ template, widget }: WidgetProps) {
  const enabled = template.automations.filter((a) => a.enabledByDefault).slice(0, 4);
  return (
    <Card title={widget.title ?? "Automations"} href="/app/automations" span={widget.span} delay={280} sample={false}>
      <ul className="grid gap-2 md:grid-cols-2">
        {enabled.map((a) => (
          <li key={a.id} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="anim-pulse mt-1.5 h-2 w-2 shrink-0 rounded-full bg-good" aria-hidden="true" />
            <span>
              <span className="block font-medium">{a.when}</span>
              <span className="block text-xs text-muted">{a.then}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Timetable({ widget }: WidgetProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slots = [
    ["Physics 9", "", "Physics 9", "", "Test"],
    ["", "Maths 10", "", "Maths 10", ""],
    ["Chem 11", "Chem 11", "", "", "Chem 11"],
  ];
  return (
    <Card title={widget.title ?? "This week"} href="/app/timetable" span={widget.span} delay={80}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>{days.map((d) => <th key={d} scope="col" className="pb-1 text-left text-xs font-medium text-muted">{d}</th>)}</tr>
          </thead>
          <tbody>
            {slots.map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i} className={`h-12 rounded-lg px-2 text-xs ${c ? "bg-surface-2 font-medium" : ""}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Fees({ widget, profile }: WidgetProps) {
  return (
    <Card title={widget.title ?? "Fees this month"} href="/app/finance" span={widget.span} delay={120}>
      <div className="space-y-3">
        {[
          { label: "Received", value: 22, tone: "bg-good" },
          { label: "Due", value: 4, tone: "bg-accent" },
          { label: "Overdue", value: 2, tone: "bg-warn" },
        ].map((f) => (
          <div key={f.label}>
            <div className="flex justify-between text-sm"><span>{f.label}</span><span className="font-mono text-xs text-muted">{f.value} students</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={`anim-fill h-1.5 rounded-full ${f.tone}`} style={{ width: `${(f.value / 28) * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted">Amounts in {profile.currency}</p>
      </div>
    </Card>
  );
}

function ContentCalendar({ widget }: WidgetProps) {
  const posts = [
    { day: "Mon", title: "Product teaser reel", ch: "Instagram" },
    { day: "Wed", title: "How-to carousel", ch: "LinkedIn" },
    { day: "Thu", title: "Client campaign launch", ch: "Meta Ads" },
    { day: "Sat", title: "Behind the scenes", ch: "TikTok" },
  ];
  return (
    <Card title={widget.title ?? "Content this week"} href="/app/content" span={widget.span} delay={80}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {posts.map((p) => (
          <li key={p.title} className="rounded-xl bg-surface-2 p-3">
            <span className="font-mono text-xs text-accent">{p.day}</span>
            <span className="mt-1 block text-sm font-medium">{p.title}</span>
            <span className="text-xs text-muted">{p.ch}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Widget registry: template widget type → component. */
const registry: Record<WidgetType, (p: WidgetProps) => ReactNode> = {
  kpis: Kpis,
  opportunities: Opportunities,
  today: Today,
  money: Money,
  projects: Projects,
  pipeline: Pipeline,
  "automation-log": AutomationLog,
  timetable: Timetable,
  fees: Fees,
  "content-calendar": ContentCalendar,
};

export function WidgetGrid({ template, profile, data }: { template: Template; profile: Profile; data: WorkData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {template.widgets.map((w, i) => {
        const Component = registry[w.type];
        return <Component key={`${w.type}-${i}`} template={template} profile={profile} widget={w} data={data} />;
      })}
    </div>
  );
}
