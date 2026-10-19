"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="lift h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
      Print / save as PDF
    </button>
  );
}
