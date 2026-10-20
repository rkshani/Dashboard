import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

export function SectionHeading({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: string; id?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-base text-muted sm:text-lg">{intro}</p>}
    </Reveal>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`lift rounded-2xl border border-line bg-surface p-6 ${className}`}>{children}</div>;
}

/** Minimal stroke icons, so we ship no icon library. */
const paths: Record<string, string> = {
  radar: "M12 12 L19 5 M12 3 a9 9 0 1 0 9 9 M12 7 a5 5 0 1 0 5 5",
  layout: "M4 4h16v16H4z M4 10h16 M10 10v10",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M21 19v-1a4 4 0 0 0-3-3.87 M15 3.13a4 4 0 0 1 0 7.75",
  check: "M9 11l3 3 8-8 M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11",
  calendar: "M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4",
  wallet: "M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3z M3 7l12-3v3 M17 13.5h.01",
  zap: "M13 2L4 14h7l-1 8 9-12h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h6",
  home: "M4 11l8-7 8 7 M6 9.5V20h12V9.5 M10 20v-6h4v6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  logout: "M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4 M16 17l5-5-5-5 M21 12H9",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M6 6l12 12 M18 6L6 18",
  plus: "M12 5v14 M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M20 20l-4-4",
  edit: "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3 M14 7l3 3",
};

export function Icon({ name, className = "" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name] ?? paths.layout} />
    </svg>
  );
}
