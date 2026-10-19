"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProfile, type FormState } from "@/app/auth-actions";
import { CURRENCIES, REMOTE_PREFS, type Profile } from "@/lib/profile";
import { THEMES, type ThemeId } from "@/lib/themes";

export type TemplateSummary = {
  id: string;
  name: string;
  tagline: string;
  defaultTheme: ThemeId;
  skillsLabel: string;
  skillSuggestions: string[];
  workTypes: { id: string; label: string }[];
  rateLabel: string;
  modules: string[];
};

const STEPS = ["Your field", "Your skills", "Your work", "Your look"] as const;
const initial: FormState = { status: "idle", message: "" };

function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem("pd-theme", id);
  } catch {
    /* ignore */
  }
}

export function ProfileWizard({
  templates,
  existing,
  mode = "wizard",
}: {
  templates: TemplateSummary[];
  existing: Profile | null;
  mode?: "wizard" | "settings";
}) {
  const [state, action, pending] = useActionState(saveProfile, initial);
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(existing?.templateId ?? templates[0].id);
  const [name, setName] = useState(existing?.displayName ?? "");
  const [skills, setSkills] = useState<string[]>(existing?.skills ?? []);
  const [custom, setCustom] = useState("");
  const [theme, setTheme] = useState<ThemeId>(existing?.theme ?? templates[0].defaultTheme);
  const [themeTouched, setThemeTouched] = useState(Boolean(existing));
  const [timezone, setTimezone] = useState(existing?.timezone ?? "UTC");

  const tpl = useMemo(() => templates.find((t) => t.id === templateId) ?? templates[0], [templates, templateId]);
  const wizard = mode === "wizard";
  const last = STEPS.length - 1;

  function goNext() {
    if (!canNext) return;
    if (step === 0 && !existing) {
      try {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      } catch {
        /* keep UTC */
      }
    }
    setStep((s) => Math.min(s + 1, last));
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t && id !== templateId) {
      // Drop suggestions that belong to other fields; keep anything the user typed themselves.
      const foreign = new Set(templates.filter((x) => x.id !== id).flatMap((x) => x.skillSuggestions));
      setSkills((prev) => prev.filter((sk) => t.skillSuggestions.includes(sk) || !foreign.has(sk)));
    }
    if (t && !themeTouched) {
      setTheme(t.defaultTheme);
      applyTheme(t.defaultTheme);
    }
  }
  function pickTheme(id: ThemeId) {
    setTheme(id);
    setThemeTouched(true);
    applyTheme(id);
  }
  function toggleSkill(s: string) {
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : prev.length >= 25 ? prev : [...prev, s]));
  }
  function addCustom() {
    const v = custom.trim().replace(/,/g, " ").slice(0, 40);
    if (v && !skills.includes(v)) setSkills((p) => (p.length >= 25 ? p : [...p, v]));
    setCustom("");
  }

  const canNext = step !== 0 || name.trim().length > 0;
  const show = (i: number) => !wizard || step === i;

  const field = "h-11 w-full rounded-xl border border-line bg-bg px-3 text-[15px] focus:border-accent focus:outline-none";
  const label = "text-sm font-medium";

  return (
    <form
      action={action}
      className="flex flex-col gap-8"
      onKeyDown={(e) => {
        // Enter moves to the next step instead of submitting half a form.
        if (wizard && e.key === "Enter" && step < last && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          goNext();
        }
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="skills" value={skills.join(",")} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="timezone" value={timezone} />
      {!wizard && <input type="hidden" name="returnTo" value="settings" />}

      {wizard && (
        <ol className="flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <span className={`block h-1.5 rounded-full transition-colors duration-500 ${i <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 hidden text-xs sm:block ${i === step ? "text-ink" : "text-muted"}`} aria-current={i === step ? "step" : undefined}>
                {s}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Step 1: field + name */}
      <section hidden={!show(0)} className={wizard ? "anim-rise" : ""} aria-labelledby="s1">
        <h2 id="s1" className="font-display text-2xl font-semibold">What do you do?</h2>
        <p className="mt-1 text-sm text-muted">This picks your dashboard template. You can switch any time in Settings.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Field">
          {templates.map((t) => (
            <button
              type="button"
              key={t.id}
              role="radio"
              aria-checked={templateId === t.id}
              onClick={() => pickTemplate(t.id)}
              className={`lift cursor-pointer rounded-2xl border p-4 text-left ${templateId === t.id ? "border-accent bg-surface-2" : "border-line bg-bg"}`}
            >
              <span className="flex items-center justify-between gap-2 font-display font-semibold">
                {t.name}
                <span className={`h-4 w-4 rounded-full border-2 ${templateId === t.id ? "border-accent bg-accent" : "border-line"}`} aria-hidden="true" />
              </span>
              <span className="mt-1 block text-xs text-muted">{t.tagline}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <label htmlFor="displayName" className={label}>What should we call you?</label>
          <input id="displayName" name="displayName" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={field} />
        </div>
      </section>

      {/* Step 2: skills */}
      <section hidden={!show(1)} className={wizard ? "anim-rise" : ""} aria-labelledby="s2">
        <h2 id="s2" className="font-display text-2xl font-semibold">{tpl.skillsLabel}</h2>
        <p className="mt-1 text-sm text-muted">Pick what fits. These drive how opportunities are matched to you.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from(new Set([...tpl.skillSuggestions, ...skills])).map((s) => {
            const on = skills.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSkill(s)}
                className={`h-10 cursor-pointer rounded-full border px-4 text-sm transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg hover:border-accent"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <label htmlFor="customSkill" className="sr-only">Add another</label>
          <input
            id="customSkill"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addCustom();
              }
            }}
            placeholder="Add another…"
            className={field}
          />
          <button type="button" onClick={addCustom} className="h-11 shrink-0 cursor-pointer rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{skills.length} selected</p>
      </section>

      {/* Step 3: work preferences */}
      <section hidden={!show(2)} className={wizard ? "anim-rise" : ""} aria-labelledby="s3">
        <h2 id="s3" className="font-display text-2xl font-semibold">What work do you want?</h2>
        <fieldset className="mt-5">
          <legend className={label}>Types of work</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {tpl.workTypes.map((w) => (
              <label key={w.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg p-3 text-sm has-[:checked]:border-accent">
                <input type="checkbox" name="workTypes" value={w.id} defaultChecked={existing?.workTypes.includes(w.id) ?? true} className="h-4 w-4 accent-[var(--accent)]" />
                {w.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="rateMin" className={label}>{tpl.rateLabel} from</label>
            <input id="rateMin" name="rateMin" type="number" min={0} inputMode="decimal" defaultValue={existing?.rateMin ?? ""} className={field} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="rateMax" className={label}>to</label>
            <input id="rateMax" name="rateMax" type="number" min={0} inputMode="decimal" defaultValue={existing?.rateMax ?? ""} className={field} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="currency" className={label}>Currency</label>
            <select id="currency" name="currency" defaultValue={existing?.currency ?? "USD"} className={field}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className={label}>Where</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {REMOTE_PREFS.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm has-[:checked]:border-accent">
                <input type="radio" name="remotePref" value={r.id} defaultChecked={(existing?.remotePref ?? "remote") === r.id} className="accent-[var(--accent)]" />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-col gap-2">
          <label htmlFor="regions" className={label}>Countries or regions you can work with <span className="font-normal text-muted">(comma separated, optional)</span></label>
          <input id="regions" name="regions" defaultValue={existing?.regions.join(", ") ?? ""} placeholder="e.g. Pakistan, UAE, EU, US" className={field} />
        </div>
      </section>

      {/* Step 4: theme */}
      <section hidden={!show(3)} className={wizard ? "anim-rise" : ""} aria-labelledby="s4">
        <h2 id="s4" className="font-display text-2xl font-semibold">Pick your look</h2>
        <p className="mt-1 text-sm text-muted">Applies instantly. Time zone detected as <span className="font-mono text-ink">{timezone}</span>.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => pickTheme(t.id)}
              className={`lift cursor-pointer rounded-2xl border p-3 text-left ${theme === t.id ? "border-accent" : "border-line"}`}
            >
              <span className="block h-14 rounded-xl" style={{ background: t.swatch }} aria-hidden="true" />
              <span className="mt-2 block text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      <p aria-live="polite" className="min-h-5 text-sm text-warn">{state.status === "error" ? state.message : ""}</p>

      <div className="flex items-center justify-between gap-3">
        {wizard && step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="h-12 cursor-pointer rounded-xl border border-line px-5 font-medium hover:border-accent">
            Back
          </button>
        ) : (
          <span />
        )}
        {wizard && step < last ? (
          <button
            key="continue"
            type="button"
            disabled={!canNext}
            onClick={goNext}
            className="lift h-12 cursor-pointer rounded-xl bg-accent px-6 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          // Separate key so React never turns this same element into a submit button mid-click.
          <button key="submit" type="submit" disabled={pending || !name.trim()} className="lift h-12 cursor-pointer rounded-xl bg-accent px-6 font-semibold text-accent-ink disabled:opacity-60">
            {pending ? "Saving…" : wizard ? "Open my dashboard" : "Save changes"}
          </button>
        )}
      </div>
    </form>
  );
}
