"use client";

import { useActionState, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/data/types";

const initial: FormState = { status: "idle", message: "" };

type Result = FormState & { okCount?: number };

/**
 * A form bound to a server action that returns FormState.
 * - Submits through a transition (not the native form action), so React does not wipe the
 *   fields when the server reports a validation error.
 * - After each success the fields remount, picking up fresh values from the server
 *   (edit forms show what was saved; "new" forms come back empty).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  onSuccess,
  className = "",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel: string;
  /** Kept for readability at call sites; fields always reset after a successful save. */
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    return { ...r, okCount: (prev.okCount ?? 0) + (r.status === "success" ? 1 : 0) };
  }, initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
    // Only react to a new result, identified by its timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.at]);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <div key={state.okCount ?? 0} className="contents">
        {children}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="lift h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Saving…" : submitLabel}
        </button>
        <p aria-live="polite" className={`text-sm ${state.status === "error" ? "text-warn" : "text-good"}`}>
          {state.status !== "idle" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}

function PendingButton({ children, className, label }: { children: ReactNode; className: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

/** Small one-click action (delete, move) with optional confirmation. */
export function MiniAction({
  action,
  fields,
  children,
  label,
  confirm,
  className = "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-xs text-muted hover:bg-surface-2 hover:text-ink",
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  label?: string;
  confirm?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <PendingButton className={className} label={label}>
        {children}
      </PendingButton>
    </form>
  );
}

/** Checkbox that submits its form as soon as it changes (used for "task done"). */
export function DoneCheckbox({ action, id, done, title }: { action: (fd: FormData) => Promise<void>; id: string; done: boolean; title: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="flex">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={String(!done)} />
      <input
        type="checkbox"
        defaultChecked={done}
        onChange={() => ref.current?.requestSubmit()}
        aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
        className="h-5 w-5 cursor-pointer rounded accent-[var(--accent)]"
      />
    </form>
  );
}

/** Select that submits on change (used to move a project between columns). */
export function StatusSelect({
  action,
  id,
  value,
  options,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={value}
        aria-label={label}
        onChange={() => ref.current?.requestSubmit()}
        className="h-9 cursor-pointer rounded-lg border border-line bg-bg px-2 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
