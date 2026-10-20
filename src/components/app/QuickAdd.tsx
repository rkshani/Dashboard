"use client";

import { quickAddTransaction } from "@/app/app/finance-actions";
import { ActionForm } from "./forms";
import { inputCls, labelCls } from "./styles";

/** One-line entry: "Lunch 500 PKR yesterday". See src/lib/quick-add.ts for what it understands. */
export function QuickAdd() {
  return (
    <ActionForm action={quickAddTransaction} submitLabel="Add" pendingLabel="Adding…" resetOnSuccess>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quick-add" className={labelCls}>
          Quick add
        </label>
        <input id="quick-add" name="text" required maxLength={200} autoComplete="off" placeholder="Lunch 500 PKR yesterday" aria-describedby="quick-add-hint" className={inputCls} />
        <p id="quick-add-hint" className="text-xs text-muted">
          Also works: &quot;+50000 salary&quot;, &quot;Uber 12 USD 3 days ago&quot;, &quot;rent 2 lakh 1 oct&quot;.
        </p>
      </div>
    </ActionForm>
  );
}
