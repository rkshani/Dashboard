import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/SiteChrome";
import { EmailLoginForm } from "@/components/auth/EmailLoginForm";
import { signInWithGoogle, startDemo } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const errors: Record<string, string> = {
  callback: "That sign-in link expired or was already used. Please try again.",
  oauth: "Google sign-in didn't start. Please try again.",
  "not-configured": "Sign-in isn't set up yet. Use demo mode for now.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="anim-rise w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-2 text-sm text-muted">Sign in to {site.name}. New here? The same buttons create your account.</p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface-2" />}>
          <LoginBody searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginBody({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  if (await getCurrentUser()) redirect("/app");
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/app") ? sp.next : "/app";
  const error = typeof sp.error === "string" ? errors[sp.error] : undefined;
  const configured = supabaseConfigured();

  return (
    <div className="mt-8 flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-xl border border-warn/40 bg-surface-2 p-3 text-sm text-warn">
          {error}
        </p>
      )}

      {configured ? (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="lift flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-accent font-semibold text-accent-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33Z" />
                <path fill="currentColor" opacity=".8" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z" />
                <path fill="currentColor" opacity=".6" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96L6.4 13.9Z" />
                <path fill="currentColor" opacity=".9" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.52L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98Z" />
              </svg>
              Continue with Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <EmailLoginForm next={next} />
        </>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
            <strong className="text-ink">Demo mode.</strong> Supabase isn&apos;t configured, so accounts are off. Your
            choices are kept in a cookie in this browser only.
          </div>
          <form action={startDemo}>
            <button type="submit" className="lift h-12 w-full cursor-pointer rounded-xl bg-accent font-semibold text-accent-ink">
              Try the demo
            </button>
          </form>
        </>
      )}
    </div>
  );
}
