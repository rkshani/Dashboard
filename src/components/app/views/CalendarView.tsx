import Link from "next/link";
import { createCalendarEvent, disconnectGoogle } from "@/app/app/calendar-actions";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { eventDay, eventTime, type CalendarState } from "@/lib/calendar";
import type { CalEvent } from "@/lib/calendar/types";
import { addDays, relativeDay } from "@/lib/dates";
import type { Project, Task } from "@/lib/data/types";

const errors: Record<string, string> = {
  "not-configured": "Google Calendar isn't set up on this server yet (missing Google keys or encryption key).",
  denied: "You cancelled the Google permission screen.",
  state: "That connection attempt expired. Please try again.",
  "no-refresh-token": "Google didn't grant offline access. Please try again and allow access.",
  scope: "Calendar permission wasn't granted. Please tick the calendar box on Google's screen.",
  exchange: "Google sign-in failed. Please try again.",
};

function dayLabel(day: string, today: string) {
  const rel = relativeDay(day, today);
  const wk = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  return rel === "Today" || rel === "Tomorrow" ? `${rel} · ${wk}` : wk;
}

export function CalendarView({
  title,
  state,
  events,
  loadError,
  tasks,
  projects,
  today,
  timezone,
  notice,
  error,
}: {
  title: string;
  state: CalendarState;
  events: CalEvent[];
  loadError: boolean;
  tasks: Task[];
  projects: Project[];
  today: string;
  timezone: string;
  notice?: string;
  error?: string;
}) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const canWrite = state.mode === "google" || state.mode === "demo";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">Next two weeks · times in {timezone}</p>
        </div>
      </header>

      {notice && <p role="status" className="anim-rise mt-4 rounded-xl border border-good/40 bg-surface p-3 text-sm text-good">{notice}</p>}
      {error && <p role="alert" className="anim-rise mt-4 rounded-xl border border-warn/40 bg-surface p-3 text-sm text-warn">{errors[error] ?? "Something went wrong."}</p>}

      {/* Connection */}
      <section aria-label="Google Calendar connection" className="anim-rise mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "60ms" }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 font-display text-lg font-bold text-accent" aria-hidden="true">G</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Google Calendar</p>
          <p className="text-sm text-muted">
            {state.mode === "google" && <>Connected{state.email ? ` as ${state.email}` : ""}. Meetings show on Today and in your daily digest.</>}
            {state.mode === "needs-reconnect" && <>Access expired or was revoked. Reconnect to keep syncing.</>}
            {state.mode === "disconnected" && <>Connect to see meetings here, on Today, and in your morning digest.</>}
            {state.mode === "not-configured" && <>Not set up on this server yet. Add the Google keys from the README.</>}
            {state.mode === "demo" && <>Demo mode: showing example events kept in this browser session.</>}
          </p>
        </div>
        {(state.mode === "disconnected" || state.mode === "needs-reconnect") && (
          <a href="/api/integrations/google/start" className="lift flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
            {state.mode === "needs-reconnect" ? "Reconnect" : "Connect Google Calendar"}
          </a>
        )}
        {state.mode === "google" && (
          <MiniAction action={disconnectGoogle} fields={{}} confirm="Disconnect Google Calendar? We'll revoke access and delete the stored token." className="h-11 cursor-pointer rounded-xl border border-line px-4 text-sm hover:border-warn hover:text-warn">
            Disconnect
          </MiniAction>
        )}
      </section>

      {loadError && <p className="mt-4 rounded-xl border border-warn/40 bg-surface p-3 text-sm text-warn">Couldn&apos;t load events from Google right now. Showing tasks only.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Agenda */}
        <section aria-label="Agenda" className="anim-rise rounded-2xl border border-line bg-surface p-5 lg:col-span-3" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 font-display text-lg font-semibold">Agenda</h2>
          <ol className="flex flex-col gap-5">
            {days.map((d) => {
              const dayEvents = events.filter((e) => eventDay(e, timezone) === d).sort((a, b) => a.start.localeCompare(b.start));
              const dayTasks = tasks.filter((t) => !t.done && t.dueDate === d);
              const deadlines = projects.filter((p) => p.status !== "done" && p.deadline === d);
              if (!dayEvents.length && !dayTasks.length && !deadlines.length && d !== today) return null;
              return (
                <li key={d}>
                  <h3 className={`mb-2 text-sm font-semibold ${d === today ? "text-accent" : ""}`}>{dayLabel(d, today)}</h3>
                  {!dayEvents.length && !dayTasks.length && !deadlines.length && <p className="text-sm text-muted">Nothing scheduled.</p>}
                  <ul className="flex flex-col gap-1.5">
                    {dayEvents.map((e) => (
                      <li key={e.id} className="flex gap-3 rounded-xl bg-surface-2/60 px-3 py-2.5">
                        <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-muted">{eventTime(e, timezone)}</span>
                        <span className="w-0.5 shrink-0 rounded bg-accent" aria-hidden="true" />
                        <span className="min-w-0">
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">{e.title}</a>
                          ) : (
                            <span className="block truncate text-sm font-medium">{e.title}</span>
                          )}
                          {e.location && <span className="block truncate text-xs text-muted">{e.location}</span>}
                        </span>
                      </li>
                    ))}
                    {deadlines.map((p) => (
                      <li key={p.id} className="flex gap-3 rounded-xl px-3 py-2">
                        <span className="w-14 shrink-0 font-mono text-xs text-warn">Due</span>
                        <span className="w-0.5 shrink-0 rounded bg-warn" aria-hidden="true" />
                        <span className="text-sm">{p.title} deadline</span>
                      </li>
                    ))}
                    {dayTasks.map((t) => (
                      <li key={t.id} className="flex gap-3 rounded-xl px-3 py-2">
                        <span className="w-14 shrink-0 font-mono text-xs text-muted">Task</span>
                        <span className={`w-0.5 shrink-0 rounded ${t.priority === "high" ? "bg-warn" : "bg-line"}`} aria-hidden="true" />
                        <Link href="/app/tasks" className="truncate text-sm hover:underline">{t.title}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        {/* New event */}
        <section aria-label="New event" className="anim-rise h-fit rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-3 font-display text-lg font-semibold">New event</h2>
          {canWrite ? (
            <ActionForm action={createCalendarEvent} submitLabel={state.mode === "google" ? "Add to Google Calendar" : "Add event"} resetOnSuccess>
              <div className="grid gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Title *</span>
                  <input name="title" required maxLength={200} className={inputCls} placeholder="Client call, class, review…" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>Date</span>
                    <input name="date" type="date" required defaultValue={today} className={inputCls} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>Start</span>
                    <input name="startTime" type="time" defaultValue="10:00" className={inputCls} />
                  </label>
                </div>
                <div className="grid grid-cols-2 items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>Duration</span>
                    <select name="durationMin" defaultValue="60" className={inputCls}>
                      {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                        <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex h-11 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" name="allDay" className="h-4 w-4 accent-[var(--accent)]" /> All day
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Notes</span>
                  <textarea name="description" maxLength={2000} rows={2} className={`${inputCls} h-auto py-2`} />
                </label>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">Connect Google Calendar to add events from here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
