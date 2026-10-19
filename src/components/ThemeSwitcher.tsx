"use client";

import { useSyncExternalStore } from "react";

import { THEMES, type ThemeId } from "@/lib/themes";

// The <html data-theme> attribute is the single source of truth.
function readTheme(): ThemeId {
  return (document.documentElement.dataset.theme as ThemeId) || "midnight";
}
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem("pd-theme", id);
  } catch {
    /* storage unavailable: theme still applies for this visit */
  }
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "midnight" as ThemeId);

  return (
    <div role="group" aria-label="Color theme" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => applyTheme(t.id)}
          aria-pressed={theme === t.id}
          aria-label={`${t.label} theme`}
          className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
            theme === t.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <span className="h-3 w-3 rounded-full ring-2 ring-line" style={{ background: t.swatch }} aria-hidden="true" />
          {!compact && <span className="hidden md:inline">{t.label}</span>}
        </button>
      ))}
    </div>
  );
}
