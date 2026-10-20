"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchEverything } from "@/app/app/search-actions";
import { Icon } from "@/components/Sections";
import { normalize, type SearchHit } from "@/lib/search";
import type { NavItem } from "./Sidebar";

export const OPEN_PALETTE_EVENT = "dash:open-palette";

type Row = { key: string; label: string; hint?: string; href: string; group: string; icon: string };

const kindLabel: Record<SearchHit["kind"], { group: string; icon: string }> = {
  client: { group: "People", icon: "users" },
  project: { group: "Work", icon: "layout" },
  task: { group: "Tasks", icon: "check" },
  invoice: { group: "Invoices", icon: "file" },
  opportunity: { group: "Pipeline", icon: "radar" },
};

/** Ctrl+K / ⌘K anywhere in the app: jump to a page, run a quick action, or search your data. */
export function CommandPalette({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  const listId = useId();

  const show = () => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
    lastFocus.current?.focus?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const onChange = (value: string) => {
    setQuery(value);
    setActive(0);
    const id = ++seq.current;
    if (!value.trim()) {
      setHits([]);
      return;
    }
    // Small debounce; stale responses are ignored by sequence number.
    window.setTimeout(() => {
      if (id !== seq.current) return;
      start(async () => {
        const r = await searchEverything(value);
        if (id === seq.current) setHits(r);
      });
    }, 140);
  };

  const actions: Row[] = [
    { key: "a-task", label: "Add a task", href: "/app/tasks", group: "Actions", icon: "plus" },
    ...(items.some((i) => i.href === "/app/invoices") ? [{ key: "a-inv", label: "Create an invoice", href: "/app/invoices", group: "Actions", icon: "plus" }] : []),
    ...(items.some((i) => i.href === "/app/finance") ? [{ key: "a-tx", label: "Log income or an expense", href: "/app/finance", group: "Actions", icon: "plus" }] : []),
    { key: "a-digest", label: "Preview my daily digest", href: "/app/digest-preview", group: "Actions", icon: "zap" },
  ];
  const nq = normalize(query);
  const pages: Row[] = items.map((i) => ({ key: `p-${i.href}`, label: i.label, hint: "Go to", href: i.href, group: "Pages", icon: i.icon }));
  const local = [...pages, ...actions].filter((r) => !nq || normalize(r.label).includes(nq));
  const data: Row[] = hits.map((h) => ({ key: `${h.kind}-${h.id}`, label: h.title, hint: h.subtitle, href: h.href, group: kindLabel[h.kind].group, icon: kindLabel[h.kind].icon }));
  const rows = nq ? [...data, ...local] : local;

  const go = (r: Row | undefined) => {
    if (!r) return;
    close();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  };

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="anim-rise w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="h-5 w-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
            aria-label="Search clients, projects, tasks, invoices, or type a command"
            placeholder="Search or jump to…"
            maxLength={100}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted focus-visible:outline-none"
          />
          {pending && <span className="text-xs text-muted">Searching…</span>}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-muted sm:inline">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[55vh] overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{pending ? "Searching…" : `No matches for “${query}”.`}</li>}
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={r.key} role="presentation">
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${i === active ? "bg-surface-2 text-ink" : "text-ink/90"}`}
                >
                  <Icon name={r.icon} className={`h-4 w-4 shrink-0 ${i === active ? "text-accent" : "text-muted"}`} />
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  {r.hint && <span className="max-w-[45%] truncate text-xs text-muted">{r.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted">↑ ↓ to move · Enter to open · Ctrl K to toggle</p>
      </div>
    </div>
  );
}

/** Button that opens the palette (for mouse and touch users). */
export function SearchButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      aria-label="Search (Ctrl K)"
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-line text-sm text-muted hover:border-accent hover:text-ink ${compact ? "h-11 w-11 justify-center" : "h-11 w-full px-3"} ${className}`}
    >
      <Icon name="search" className="h-4 w-4" />
      {!compact && (
        <>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
        </>
      )}
    </button>
  );
}
