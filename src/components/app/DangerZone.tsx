"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/app/account-actions";
import type { FormState } from "@/lib/data/types";

const initial: FormState = { status: "idle", message: "" };

export function DangerZone() {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  const [text, setText] = useState("");
  return (
    <form action={action} className="mt-4 rounded-xl border border-warn/40 p-4">
      <p className="text-sm font-medium text-warn">Delete my account</p>
      <p className="mt-1 text-sm text-muted">Permanently removes your profile, clients, projects, tasks, money records, invoices and connected accounts. This can&apos;t be undone.</p>
      <label htmlFor="confirm-delete" className="mt-3 block text-xs text-muted">
        Type DELETE to confirm
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id="confirm-delete"
          name="confirm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          className="h-11 w-40 rounded-xl border border-line bg-bg px-3 text-sm focus:border-warn focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || text.trim().toUpperCase() !== "DELETE"}
          className="h-11 cursor-pointer rounded-xl bg-warn px-4 text-sm font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-warn">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
