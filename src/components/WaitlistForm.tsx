"use client";

import { useActionState, useId } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions";
import { roles } from "@/lib/site";

const initial: WaitlistState = { status: "idle", message: "" };

export function WaitlistForm({ defaultRole = "software-engineers", source = "home" }: { defaultRole?: string; source?: string }) {
  const [state, action, pending] = useActionState(joinWaitlist, initial);
  const id = useId();

  if (state.status === "success") {
    return (
      <div role="status" className="anim-rise rounded-2xl border border-line bg-surface p-5 text-sm">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-good align-middle" aria-hidden="true" />
        {state.message}
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-3" noValidate>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot field, hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-web`}>Company website</label>
        <input id={`${id}-web`} name="company_website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-12 w-full min-w-0 rounded-xl sm:w-auto sm:flex-1 border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <label htmlFor={`${id}-role`} className="sr-only">
          Your field
        </label>
        <select
          id={`${id}-role`}
          name="role"
          defaultValue={defaultRole}
          className="h-12 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none"
        >
          {roles.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="lift h-12 cursor-pointer rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-ink disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <p aria-live="polite" className={`min-h-5 text-sm ${state.status === "error" ? "text-warn" : "text-muted"}`}>
        {state.status === "error" ? state.message : "Early-bird pricing for everyone on the list. No spam."}
      </p>
    </form>
  );
}
