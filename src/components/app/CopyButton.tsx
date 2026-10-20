"use client";

import { useState } from "react";

/** Copies the current text of a field (by id), so edits made since the last save are included. */
export function CopyButton({ targetId, label = "Copy" }: { targetId: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
        if (!el) return;
        try {
          await navigator.clipboard.writeText(el.value);
        } catch {
          el.select();
          document.execCommand("copy");
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="h-11 cursor-pointer rounded-xl border border-line px-4 text-sm font-medium hover:border-accent"
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
