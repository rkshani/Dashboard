"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
import { idSchema, INVOICE_STATUSES, invoiceInput, invoiceTotal, transactionInput, type FormState } from "@/lib/data/types";

const ok = (message: string): FormState => ({ status: "success", message, at: Date.now() });
const fail = (message: string): FormState => ({ status: "error", message, at: Date.now() });

async function run(fn: () => Promise<void>, success: string): Promise<FormState> {
  try {
    await fn();
    refresh();
    return ok(success);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirects
    if (e instanceof NotFoundError) return fail("That item no longer exists or can't be changed.");
    if (e instanceof Error && e.message === "Demo limit reached") return fail("Demo limit reached. Delete something first.");
    console.error("[finance]", e);
    return fail("Something went wrong. Please try again.");
  }
}

const get = (fd: FormData, k: string) => (fd.get(k) as string | null) ?? undefined;

export async function addTransaction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = transactionInput.safeParse({
    kind: get(fd, "kind"),
    amount: get(fd, "amount"),
    category: get(fd, "category"),
    date: get(fd, "date"),
    note: get(fd, "note"),
    clientId: get(fd, "clientId"),
    projectId: get(fd, "projectId"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo, currency } = await getRepo();
  return run(async () => void (await repo.createTransaction({ ...parsed.data, currency })), parsed.data.kind === "income" ? "Income added." : "Expense added.");
}

export async function deleteTransaction(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await run(() => repo.deleteTransaction(id.data), "Deleted.");
}

function nextNumber(existing: string[]) {
  const max = existing.reduce((m, n) => {
    const v = Number(/(\d+)\s*$/.exec(n)?.[1] ?? 0);
    return v > m ? v : m;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export async function saveInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = invoiceInput.safeParse({
    clientId: get(fd, "clientId"),
    projectId: get(fd, "projectId"),
    issueDate: get(fd, "issueDate"),
    dueDate: get(fd, "dueDate"),
    notes: get(fd, "notes"),
    items: get(fd, "items") ?? "[]",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.dueDate && parsed.data.dueDate < parsed.data.issueDate) return fail("Due date can't be before the issue date.");

  const total = invoiceTotal(parsed.data.items);
  const { repo, currency } = await getRepo();
  const id = fd.get("id");
  if (id) {
    const pid = idSchema.safeParse(id);
    if (!pid.success) return fail("Invalid id.");
    return run(() => repo.updateInvoice(pid.data, { ...parsed.data, total }), "Invoice saved.");
  }
  return run(async () => {
    const existing = await repo.listInvoices();
    await repo.createInvoice({ ...parsed.data, total, currency, number: nextNumber(existing.map((i) => i.number)) });
  }, "Invoice created.");
}

export async function setInvoiceStatus(fd: FormData) {
  const parsed = z.object({ id: idSchema, status: z.enum(INVOICE_STATUSES) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  const { repo, today } = await getRepo();
  await run(() => repo.setInvoiceStatus(parsed.data.id, parsed.data.status, today), "Updated.");
}

export async function deleteInvoice(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await run(() => repo.deleteInvoice(id.data), "Deleted.");
}
