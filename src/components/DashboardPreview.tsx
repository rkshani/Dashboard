/** Animated, decorative preview of the dashboard used in the hero. Sample data only. */
const opps = [
  { score: 94, title: "Flutter developer for fintech MVP", meta: "Lead · Remote · 2h ago", kind: "LEAD" },
  { score: 89, title: "Senior Android Engineer (Kotlin)", meta: "Job · Remote, EU hours · 4h ago", kind: "JOB" },
  { score: 83, title: "Rebuild delivery app in Compose", meta: "Lead · Hourly · 5h ago", kind: "LEAD" },
];
const bars = [
  [55, 38],
  [62, 41],
  [48, 44],
  [74, 40],
  [68, 47],
  [86, 43],
];
const today = [
  { time: "09:30", title: "Standup with agency team", tone: "bg-accent" },
  { time: "11:00", title: "Client call: app scope", tone: "bg-warn" },
  { time: "14:00", title: "Ship build to QA", tone: "bg-good" },
];

export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the PilotDesk dashboard showing matched opportunities, today's schedule and a monthly money chart"
      className="anim-rise relative rounded-3xl border border-line bg-surface p-3 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)] sm:p-4"
      style={{ animationDelay: "0.15s" }}
    >
      <div className="flex items-center gap-1.5 px-1 pb-3" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>
      <div className="grid gap-3 md:grid-cols-5" aria-hidden="true">
        <div className="rounded-2xl border border-line bg-bg p-4 md:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-sm font-semibold">New opportunities</span>
            <span className="anim-pulse h-2 w-2 rounded-full bg-good" />
            <span className="text-xs text-muted">auto-fetched</span>
          </div>
          <ul className="flex flex-col gap-2">
            {opps.map((o, i) => (
              <li
                key={o.title}
                className="anim-rise flex items-center gap-3 rounded-xl bg-surface p-2.5"
                style={{ animationDelay: `${0.35 + i * 0.12}s` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-sm text-accent">
                  {o.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{o.title}</span>
                  <span className="block text-[11px] text-muted">{o.meta}</span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded bg-surface-2">
                    <span className="anim-fill block h-1 rounded bg-accent" style={{ width: `${o.score}%` }} />
                  </span>
                </span>
                <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted sm:inline">
                  {o.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="rounded-2xl border border-line bg-bg p-4">
            <div className="mb-2 font-display text-sm font-semibold">Today</div>
            {today.map((d) => (
              <div key={d.time} className="flex items-center gap-3 py-1.5 text-[12px]">
                <span className="w-10 font-mono text-muted">{d.time}</span>
                <span className={`h-4 w-0.5 rounded ${d.tone}`} />
                <span className="truncate">{d.title}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-bg p-4">
            <div className="mb-3 font-display text-sm font-semibold">Money</div>
            <div className="flex h-20 items-end gap-2">
              {bars.map(([inc, exp], i) => (
                <div key={i} className="flex h-full flex-1 items-end gap-0.5">
                  <span className="anim-grow block flex-1 rounded-t bg-accent" style={{ height: `${inc}%`, animationDelay: `${0.4 + i * 0.06}s` }} />
                  <span className="anim-grow block flex-1 rounded-t bg-line" style={{ height: `${exp}%`, animationDelay: `${0.45 + i * 0.06}s` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
