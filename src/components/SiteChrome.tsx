import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { roles, site } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-accent-ink" aria-hidden="true">
          <path d="M4 18 L12 4 L20 18 Z" />
          <path d="M9 13 h6" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/#features" className="hover:text-ink">Features</Link>
          <Link href="/#how-it-works" className="hover:text-ink">How it works</Link>
          <Link href="/#templates" className="hover:text-ink">Templates</Link>
          <Link href="/#faq" className="hover:text-ink">FAQ</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeSwitcher compact />
          <Link href="/login" className="hidden text-sm text-muted hover:text-ink sm:block">
            Sign in
          </Link>
          <Link href="/#waitlist" className="lift hidden h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink sm:flex">
            Get early access
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">{site.tagline}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Templates</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {roles.map((r) => (
              <li key={r.slug}>
                <Link href={`/for/${r.slug}`} className="hover:text-ink">
                  For {r.plural.split(" and ")[0]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><a href={`mailto:${site.contactEmail}`} className="hover:text-ink">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-muted">
        © {site.name}. All rights reserved.
      </div>
    </footer>
  );
}
