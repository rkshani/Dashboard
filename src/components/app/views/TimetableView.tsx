import Link from "next/link";
import { addSlot, deleteSlot } from "@/app/app/teaching-actions";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { Icon } from "@/components/Sections";
import type { Project, TimetableSlot } from "@/lib/data/types";
import { addDaysISO } from "@/lib/recurrence";
import { isoWeekday, weekStart } from "@/lib/teaching/fees";
import type { Template } from "@/templates";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const tones = ["border-l-accent", "border-l-good", "border-l-warn", "border-l-ink"];

function fmtDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Weekly class timetable. Today's classes come first, each with a link to take attendance. */
export function TimetableView({ template, title, slots, classes, today, studentCount, markedToday }: { template: Template; title: string; slots: TimetableSlot[]; classes: Project[]; today: string; studentCount: Record<string, number>; markedToday: Set<string> }) {
  const v = template.vocabulary;
  const cls = new Map(classes.map((c, i) => [c.id, { ...c, tone: tones[i % tones.length] }]));
  const monday = weekStart(today);
  const todayWd = isoWeekday(today);
  const todays = slots.filter((s) => s.weekday === todayWd);
  const active = classes.filter((c) => c.status !== "done");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">
            {slots.length} {slots.length === 1 ? "class" : "classes"} a week · {todays.length} today
          </p>
        </div>
        <Link href="/app/attendance" className="lift inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
          Attendance
        </Link>
      </header>

      <section aria-label="Today" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "60ms" }}>
        <h2 className="font-display text-lg font-semibold">Today, {DAYS[todayWd - 1]}</h2>
        {todays.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No classes today.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((s) => {
              const c = cls.get(s.classId);
              const done = markedToday.has(s.classId);
              return (
                <li key={s.id} className={`rounded-xl border border-line border-l-4 bg-bg p-3 ${c?.tone ?? ""}`}>
                  <p className="font-mono text-xs text-muted">
                    {s.start}–{s.end}
                  </p>
                  <Link href={`/app/project/${s.classId}`} className="mt-1 block font-medium hover:text-accent hover:underline">
                    {c?.title ?? v.project}
                  </Link>
                  <p className="text-xs text-muted">{[s.location, `${studentCount[s.classId] ?? 0} students`].filter(Boolean).join(" · ")}</p>
                  <Link href={`/app/attendance?class=${s.classId}&date=${today}`} className={`mt-3 inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold ${done ? "border border-good/40 text-good" : "bg-accent text-accent-ink"}`}>
                    {done ? "Attendance taken ✓" : "Take attendance"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="This week" className="anim-rise mt-6" style={{ animationDelay: "120ms" }}>
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          {DAYS.map((d, i) => {
            const date = addDaysISO(monday, i);
            const daySlots = slots.filter((s) => s.weekday === i + 1);
            const isToday = date === today;
            return (
              <div key={d} className={`min-w-0 rounded-2xl border bg-surface p-3 ${isToday ? "border-accent" : "border-line"}`}>
                <h3 className="flex items-baseline justify-between text-sm font-semibold">
                  {d.slice(0, 3)} <span className="text-xs font-normal text-muted">{fmtDay(date)}</span>
                </h3>
                {daySlots.length === 0 ? (
                  <p className="mt-3 text-xs text-muted">Free</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {daySlots.map((s) => {
                      const c = cls.get(s.classId);
                      return (
                        <li key={s.id} className={`group relative rounded-lg border-l-4 bg-surface-2 p-2 ${c?.tone ?? ""}`}>
                          <p className="font-mono text-[11px] text-muted">
                            {s.start}–{s.end}
                          </p>
                          <p className="text-xs font-medium leading-snug">{c?.title ?? "Deleted class"}</p>
                          {s.location && <p className="truncate text-[11px] text-muted">{s.location}</p>}
                          <div className="absolute right-1 top-1">
                            <MiniAction action={deleteSlot} fields={{ id: s.id }} label={`Remove ${c?.title ?? "class"} on ${d} at ${s.start}`} confirm={`Remove this ${d} ${s.start} slot?`}>
                              <Icon name="close" className="h-3.5 w-3.5" />
                            </MiniAction>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Add a class to the timetable" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "180ms" }}>
        <h2 className="mb-4 font-display text-lg font-semibold">Add a weekly slot</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted">
            First add a class on the{" "}
            <Link href="/app/projects" className="text-accent underline">
              {v.projects}
            </Link>{" "}
            page.
          </p>
        ) : (
          <ActionForm action={addSlot} submitLabel="Add slot" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={labelCls}>{v.project}</span>
                <select name="classId" required className={inputCls}>
                  {active.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Day</span>
                <select name="weekday" defaultValue={todayWd} className={inputCls}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Starts</span>
                <input name="start" type="time" required defaultValue="16:00" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Ends</span>
                <input name="end" type="time" required defaultValue="17:00" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-5">
                <span className={labelCls}>Where (optional)</span>
                <input name="location" maxLength={120} placeholder="e.g. Home, room 1 or Google Meet" className={inputCls} />
              </label>
            </div>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
