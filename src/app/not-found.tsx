import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-muted">The link may be old, or the page belongs to a different template.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/app" className="lift flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
            Open dashboard
          </Link>
          <Link href="/" className="flex h-11 items-center rounded-xl border border-line px-5 text-sm hover:border-accent">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
