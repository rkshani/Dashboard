import Link from "next/link";
import type { ReactNode } from "react";
import type { Profile } from "@/lib/profile";
import type { Template } from "@/templates";
import type { WidgetType } from "@/templates/types";
import { sampleMoney, sampleOpportunities, sampleToday } from "./sample-data";

type WidgetConfig = Template["widgets"][number];
type WidgetProps = { template: Template; profile: Profile; widget: WidgetConfig };

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

function Kpis({ template, profile }: WidgetProps) {
  const v = template.vocabulary;
  const items =
    template.id === "teacher"
      ? [
          { label: "Classes today", value: "4", note: "next at 09:30", tone: "text-muted" },
          { label: v.clients, value: "28", note: "3 new this month", tone: "text-good" },
          { label: "Fees due", value: "6", note: "2 overdue", tone: "text-warn" },
          { label: "New requests", value: "3", note: "matched to your subjects", tone: "text-good" },
        ]
      : [
          { label: "Due today", value: "7 tasks", note: "2 overdue", tone: "text-warn" },
          { label: `New ${v.opportunities.toLowerCase()}`, value: "12", note: "3 scored above 85", tone: "text-good" },
          { label: "Unpaid invoices", value: "2", note: `${profile.currency} [amount] pending`, tone: "text-muted" },
          { label: "Meetings", value: "3", note: "next at 11:00", tone: "text-muted" },
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

function Today({ template, widget }: WidgetProps) {
  return (
    <Card title={widget.title ?? "Today"} href="/app/tasks" span={widget.span} delay={120}>
      <ul className="flex flex-col">
        {sampleToday(template).map((d) => (
          <li key={d.time} className="flex gap-3 rounded-lg px-1 py-2.5">
            <span className="w-12 pt-0.5 font-mono text-xs text-muted">{d.time}</span>
            <span className={`w-0.5 rounded ${d.tone}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{d.title}</span>
              <span className="block text-xs text-muted">{d.sub}</span>
            </span>
          </li>
        ))}
      </ul>
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

function Projects({ template, widget }: WidgetProps) {
  const v = template.vocabulary;
  const items = [
    { name: `${v.project} A`, meta: `${v.client}: [name] · due in 12 days`, pct: 72, tone: "bg-accent" },
    { name: `${v.project} B`, meta: `${v.client}: [name] · due in 26 days`, pct: 45, tone: "bg-good" },
    { name: `${v.project} C`, meta: "No deadline", pct: 30, tone: "bg-warn" },
  ];
  return (
    <Card title={widget.title ?? `Active ${v.projects.toLowerCase()}`} href="/app/projects" span={widget.span} delay={200}>
      <ul className="flex flex-col gap-4">
        {items.map((p) => (
          <li key={p.name}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="font-mono text-xs text-muted">{p.pct}%</span>
            </div>
            <div className="text-xs text-muted">{p.meta}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={`anim-fill h-1.5 rounded-full ${p.tone}`} style={{ width: `${p.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
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

export function WidgetGrid({ template, profile }: { template: Template; profile: Profile }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {template.widgets.map((w, i) => {
        const Component = registry[w.type];
        return <Component key={`${w.type}-${i}`} template={template} profile={profile} widget={w} />;
      })}
    </div>
  );
}
