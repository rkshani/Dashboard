"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Sections";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { signOut } from "@/app/auth-actions";
import { CommandPalette, SearchButton } from "./CommandPalette";

export type NavItem = { href: string; label: string; icon: string };

export function Sidebar({ items, appName, templateName, demo }: { items: NavItem[]; appName: string; templateName: string; demo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <span className="font-display text-lg font-bold">{appName}</span>
        <div className="flex items-center gap-2">
        <SearchButton compact />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="app-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        </div>
      </div>
      <CommandPalette items={items} />

      <nav
        id="app-nav"
        aria-label="App"
        className={`${open ? "flex" : "hidden"} fixed inset-x-0 top-14 bottom-0 z-20 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0`}
      >
        <Link href="/app" className="mb-6 hidden items-center gap-2.5 px-2 pt-2 lg:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 18 L12 4 L20 18 Z" />
              <path d="M9 13 h6" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold">{appName}</span>
        </Link>

        <SearchButton className="mb-3 hidden lg:flex" />

        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
            >
              <Icon name={item.icon} className={active ? "text-accent" : ""} />
              {item.label}
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {demo && (
            <p className="rounded-xl border border-warn/40 bg-surface-2 p-3 text-xs text-muted">
              <strong className="text-warn">Demo mode.</strong> Data stays in this browser.
            </p>
          )}
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <div className="text-xs text-muted">Template</div>
            <div className="text-sm font-semibold">{templateName}</div>
            <Link href="/app/settings" onClick={() => setOpen(false)} className="text-xs text-accent hover:underline">
              Change
            </Link>
          </div>
          <ThemeSwitcher compact />
          <form action={signOut}>
            <button type="submit" className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
              <Icon name="logout" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
