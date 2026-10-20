"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly error screen for the signed-in app (database or network hiccups). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report once; the server already logged server-side errors under the same digest.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message.slice(0, 300), digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-mono text-sm text-warn">Something went wrong</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
      <p className="mt-3 text-muted">This is usually temporary. Try again, and if it keeps happening, sign out and back in.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className="lift h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
          Try again
        </button>
        <Link href="/app" className="flex h-11 items-center rounded-xl border border-line px-5 text-sm hover:border-accent">
          Go home
        </Link>
      </div>
    </div>
  );
}
