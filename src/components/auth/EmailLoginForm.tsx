"use client";

import { useActionState } from "react";
import { signInWithEmail, type FormState } from "@/app/auth-actions";

const initial: FormState = { status: "idle", message: "" };

export function EmailLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithEmail, initial);

  if (state.status === "success") {
    return (
      <p role="status" className="anim-rise rounded-xl border border-line bg-surface-2 p-4 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="login-email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="h-12 rounded-xl border border-line bg-bg px-4 text-[15px] placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="lift h-12 cursor-pointer rounded-xl border border-line bg-surface-2 font-semibold disabled:opacity-70"
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-warn">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
