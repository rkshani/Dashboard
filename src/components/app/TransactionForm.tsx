"use client";

import { useState } from "react";
import { addTransaction } from "@/app/app/finance-actions";
import { ActionForm } from "./forms";
import { inputCls, labelCls } from "./styles";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/data/types";
import { cadenceLabel, MONEY_CADENCES } from "@/lib/recurrence";
import { MONEY_CURRENCIES } from "@/lib/fx-math";

export function TransactionForm({
  today,
  currency,
  clients,
  incomeLabel = "Income",
}: {
  today: string;
  currency: string;
  clients: { id: string; name: string }[];
  incomeLabel?: string;
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <ActionForm action={addTransaction} submitLabel={kind === "income" ? `Add ${incomeLabel.toLowerCase()}` : "Add expense"} resetOnSuccess onSuccess={() => setKind("expense")}>
      <fieldset className="flex gap-1 rounded-xl border border-line bg-bg p-1" aria-label="Type">
        {(["expense", "income"] as const).map((k) => (
          <label key={k} className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-colors ${kind === k ? (k === "income" ? "bg-good/15 text-good" : "bg-warn/15 text-warn") : "text-muted"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === "income" ? incomeLabel : "Expense"}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="tx-amount" className={labelCls}>Amount *</label>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <input id="tx-amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required className={inputCls} />
            <select name="currency" defaultValue={currency} aria-label="Currency" className={inputCls}>
              {MONEY_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Date</span>
          <input name="date" type="date" defaultValue={today} required className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Category</span>
          <select key={kind} name="category" className={inputCls}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {kind === "income" ? (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>From</span>
            <select name="clientId" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Note</span>
            <input name="note" maxLength={300} className={inputCls} placeholder="e.g. Hosting" />
          </label>
        )}
        {kind === "income" && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Note</span>
            <input name="note" maxLength={300} className={inputCls} />
          </label>
        )}
        <label className={`flex flex-col gap-1.5 ${kind === "income" ? "sm:col-span-2" : ""}`}>
          <span className={labelCls}>Repeats</span>
          <select name="repeat" defaultValue="none" className={inputCls}>
            <option value="none">Just once</option>
            {MONEY_CADENCES.map((c) => (
              <option key={c} value={c}>
                {cadenceLabel[c]} (from this date)
              </option>
            ))}
          </select>
        </label>
      </div>
    </ActionForm>
  );
}
