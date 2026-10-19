import Link from "next/link";
import { runNow, saveDigestTime, sendTestDigest, toggleRule } from "@/app/app/automation-actions";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls } from "@/components/app/styles";
import { ruleEnabled } from "@/lib/automations/engine";
import { IMPLEMENTED_RULES, type AutomationLogEntry, type AutomationSettings } from "@/lib/automations/types";
import type { Template } from "@/templates";
import { timeAgo } from "./OpportunitiesView";

function hourLabel(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

export function AutomationsView({
  template,
  settings,
  log,
  timezone,
  demo,
  emailReady,
  calendarConnected,
}: {
  template: Template;
  settings: AutomationSettings;
  log: AutomationLogEntry[];
  timezone: string;
  demo: boolean;
  emailReady: boolean;
  calendarConnected: boolean;
}) {
  const digestOn = ruleEnabled(template, settings, "morning-digest");
  const rules = template.automations.filter((a) => a.id !== "morning-digest");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Automations</h1>
          <p className="text-sm text-muted">Rules run every hour. Each one acts only once per item, so nothing is ever duplicated.</p>
        </div>
        <ActionForm action={runNow} submitLabel="Run now">
          <span />
        </ActionForm>
      </header>

      {/* Daily digest */}
      <section aria-label="Daily digest" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Daily email digest</h2>
            <p className="mt-1 text-sm text-muted">
              Your meetings{calendarConnected ? "" : " (connect Google Calendar)"}, tasks due, deadlines in the next 3 days, top new matches, unpaid invoices and what automations did for you.
            </p>
          </div>
          <Switch id="morning-digest" on={digestOn} label="Daily digest" />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <ActionForm action={saveDigestTime} submitLabel="Save time" className="flex flex-wrap items-end gap-3 [&>div]:mt-0">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Send at ({timezone})</span>
              <select name="hour" defaultValue={settings.digestHour} className={`${inputCls} w-40`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Link href="/app/digest-preview" className="lift flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
            Preview today&apos;s digest
          </Link>
          {!demo && (
            <ActionForm action={sendTestDigest} submitLabel="Send me a test email">
              <span />
            </ActionForm>
          )}
          {demo && <p className="text-xs text-muted">Demo mode: emails aren&apos;t sent, but the preview shows exactly what you&apos;d get.</p>}
          {!demo && !emailReady && <p className="text-xs text-warn">Email sending isn&apos;t configured on this server yet.</p>}
        </div>
      </section>

      {/* Rules */}
      <section aria-label="Rules" className="anim-rise mt-4 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "120ms" }}>
        <h2 className="mb-2 font-display text-lg font-semibold">Rules</h2>
        <ul className="divide-y divide-line">
          {rules.map((r) => {
            const ready = IMPLEMENTED_RULES.has(r.id);
            const on = ready && ruleEnabled(template, settings, r.id);
            return (
              <li key={r.id} className="flex items-center gap-4 py-4">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "anim-pulse bg-good" : "bg-line"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="text-muted">When </span>
                    {r.when.charAt(0).toLowerCase() + r.when.slice(1)}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted">Then </span>
                    {r.then.charAt(0).toLowerCase() + r.then.slice(1)}
                  </p>
                </div>
                {ready ? <Switch id={r.id} on={on} label={r.when} /> : <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Coming soon</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Log */}
      <section aria-label="Activity" className="anim-rise mt-4 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "180ms" }}>
        <h2 className="mb-2 font-display text-lg font-semibold">What automations did</h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Rules act when something matches; press Run now to check immediately.</p>
        ) : (
          <ul className="divide-y divide-line">
            {log.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-good" aria-hidden="true" />
                <span className="flex-1">{l.message}</span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Switch({ id, on, label }: { id: string; on: boolean; label: string }) {
  return (
    <MiniAction
      action={toggleRule}
      fields={{ id, on: String(!on) }}
      label={`${on ? "Turn off" : "Turn on"}: ${label}`}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} aria-hidden="true" />
    </MiniAction>
  );
}
