"use client";

import { useState } from "react";
import { saveInvoice } from "@/app/app/finance-actions";
import { ActionForm } from "./forms";
import { inputCls, labelCls } from "./styles";
import type { Invoice, InvoiceItem } from "@/lib/data/types";
import { fmtMoney } from "@/lib/money";

type Line = { key: number; description: string; quantity: string; rate: string };
let seq = 0;
const blank = (): Line => ({ key: ++seq, description: "", quantity: "1", rate: "" });
const fromItems = (items: InvoiceItem[]): Line[] => items.map((i) => ({ key: ++seq, description: i.description, quantity: String(i.quantity), rate: String(i.rate) }));

export function InvoiceBuilder({
  invoice,
  clients,
  projects,
  today,
  currency,
  defaultDueDate = null,
  clientLabel,
  projectLabel,
}: {
  defaultDueDate?: string | null;
  invoice?: Invoice;
  clients: { id: string; name: string }[];
  projects: { id: string; title: string; clientId: string | null }[];
  today: string;
  currency: string;
  clientLabel: string;
  projectLabel: string;
}) {
  const [lines, setLines] = useState<Line[]>(() => (invoice ? fromItems(invoice.items) : [blank()]));
  const [clientId, setClientId] = useState(invoice?.clientId ?? "");

  const items = lines
    .filter((l) => l.description.trim() || l.rate)
    .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0 }));
  const total = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const visibleProjects = clientId ? projects.filter((p) => p.clientId === clientId || !p.clientId) : projects;

  return (
    <ActionForm
      action={saveInvoice}
      submitLabel={invoice ? "Save invoice" : "Create invoice"}
      resetOnSuccess={!invoice}
      onSuccess={() => {
        if (!invoice) {
          setLines([blank()]);
          setClientId("");
        }
      }}
    >
      {invoice && <input type="hidden" name="id" value={invoice.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{clientLabel}</span>
          <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{projectLabel}</span>
          <select name="projectId" defaultValue={invoice?.projectId ?? ""} className={inputCls}>
            <option value="">—</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Issue date</span>
          <input name="issueDate" type="date" required defaultValue={invoice?.issueDate ?? today} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Due date</span>
          <input name="dueDate" type="date" defaultValue={invoice ? (invoice.dueDate ?? "") : (defaultDueDate ?? "")} className={inputCls} />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className={labelCls}>Lines</legend>
        <div className="mt-2 hidden grid-cols-[1fr_80px_110px_90px_36px] gap-2 px-1 text-[11px] text-muted sm:grid" aria-hidden="true">
          <span>Description</span>
          <span>Qty</span>
          <span>Rate ({currency})</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ul className="mt-1 flex flex-col gap-2">
          {lines.map((l, i) => (
            <li key={l.key} className="grid grid-cols-[1fr_1fr_36px] gap-2 rounded-xl bg-surface-2/50 p-2 sm:grid-cols-[1fr_80px_110px_90px_36px] sm:bg-transparent sm:p-0">
              <input
                aria-label={`Line ${i + 1} description`}
                value={l.description}
                onChange={(e) => update(l.key, { description: e.target.value })}
                maxLength={200}
                placeholder="What you did"
                className={`${inputCls} col-span-3 sm:col-span-1`}
              />
              <input aria-label={`Line ${i + 1} quantity`} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} type="number" min="0" step="any" inputMode="decimal" className={inputCls} />
              <input aria-label={`Line ${i + 1} rate`} value={l.rate} onChange={(e) => update(l.key, { rate: e.target.value })} type="number" min="0" step="any" inputMode="decimal" placeholder="0" className={inputCls} />
              <span className="hidden items-center justify-end font-mono text-sm sm:flex">{fmtMoney((Number(l.quantity) || 0) * (Number(l.rate) || 0), currency)}</span>
              <button
                type="button"
                onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))}
                aria-label={`Remove line ${i + 1}`}
                className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLines((ls) => (ls.length >= 50 ? ls : [...ls, blank()]))}
            className="h-10 cursor-pointer rounded-xl border border-line px-4 text-sm hover:border-accent"
          >
            + Add line
          </button>
          <p className="font-display text-xl font-semibold">
            Total <span className="ml-2 font-mono">{fmtMoney(total, currency)}</span>
          </p>
        </div>
      </fieldset>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelCls}>Notes (payment details, thank-you note)</span>
        <textarea name="notes" maxLength={2000} rows={2} defaultValue={invoice?.notes ?? ""} className={`${inputCls} h-auto py-2`} />
      </label>
    </ActionForm>
  );
}
