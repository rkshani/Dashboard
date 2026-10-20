"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
import { businessInput, idSchema, INVOICE_STATUSES, invoiceInput, invoiceTotal, MissingMigrationError, moneyRepeatInput, transactionInput, type FormState } from "@/lib/data/types";
import { requireProfile } from "@/lib/auth";
import { daysBetween, relativeDay } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { emailInvoice } from "@/lib/invoices/send";
import { fmtMoney } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { cadenceLabel, MONEY_CADENCES, type MoneyCadence } from "@/lib/recurrence";
import { parseCsv } from "@/lib/csv";
import { mapTransactions, txKey } from "@/lib/import/transactions";
import { describeSkipped, readCsvUpload } from "@/lib/import/upload";
import { parseQuickAdd } from "@/lib/quick-add";
import { materializeRecurring } from "@/lib/recurring";
import { materializeRecurringInvoices } from "@/lib/recurring-invoices";
import { MONEY_CURRENCIES } from "@/lib/fx-math";

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
  const repeat = moneyRepeatInput.safeParse(get(fd, "repeat") || undefined);
  if (!repeat.success) return fail("Pick how often it repeats.");
  const { repo, currency: mine, today } = await getRepo();
  const picked = get(fd, "currency");
  if (picked && !(MONEY_CURRENCIES as readonly string[]).includes(picked)) return fail("Pick a supported currency.");
  const currency = picked || mine;
  const noun = parsed.data.kind === "income" ? "income" : "expense";
  if (repeat.data === "none") return run(async () => void (await repo.createTransaction({ ...parsed.data, currency })), `${noun[0].toUpperCase()}${noun.slice(1)} added.`);
  const { date, ...rest } = parsed.data;
  return run(async () => {
    await repo.createRecurring({ ...rest, currency, cadence: repeat.data as MoneyCadence, startDate: date, nextDate: date });
    await materializeRecurring(repo, today, false);
  }, date > today ? `Repeating ${noun} saved. The first one is added on ${date}.` : `Repeating ${noun} saved and added.`);
}

/** One line like "Lunch 500 PKR yesterday" → a transaction. The parse is re-checked with the normal schema. */
export async function quickAddTransaction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { repo, currency: mine, today } = await getRepo();
  const r = parseQuickAdd(String(fd.get("text") ?? ""), today, mine);
  if (!r.ok) return fail(r.error);
  const v = r.value;
  const parsed = transactionInput.safeParse({ kind: v.kind, amount: v.amount, category: v.category, date: v.date, note: v.note ?? undefined });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const label = `${v.kind === "income" ? "Income" : "Expense"} added: ${fmtMoney(parsed.data.amount, v.currency)} · ${v.category} · ${relativeDay(v.date, today)}.`;
  return run(async () => void (await repo.createTransaction({ ...parsed.data, currency: v.currency })), label);
}

/** CSV from a bank or spreadsheet → transactions. Rows already in the ledger are skipped, so re-importing a file is safe. */
export async function importTransactionsCsv(_prev: FormState, fd: FormData): Promise<FormState> {
  const defaultKind = fd.get("defaultKind") === "income" ? "income" : "expense";
  const { repo, currency, userId } = await getRepo();
  if (!(await rateLimit(`csv-import:${userId}`, 10, 3_600_000))) return fail("You've imported a lot this hour. Try again later.");
  const upload = await readCsvUpload(fd);
  if ("error" in upload) return fail(upload.error);
  const result = mapTransactions(parseCsv(upload.text, 2001), { defaultCurrency: currency, defaultKind });
  if (result.error) return fail(result.error);

  // Skip entries already in the ledger, counting copies, so importing the same file twice adds nothing
  // while two identical coffees on the same day in one file are both kept.
  const counts = new Map<string, number>();
  for (const t of await repo.listTransactions()) counts.set(txKey(t), (counts.get(txKey(t)) ?? 0) + 1);
  let duplicates = 0;
  const fresh = result.rows.filter((t) => {
    const n = counts.get(txKey(t)) ?? 0;
    if (n > 0) counts.set(txKey(t), n - 1);
    return n > 0 ? (duplicates++, false) : true;
  });

  const parts = [fresh.length ? `Imported ${fresh.length} ${fresh.length === 1 ? "entry" : "entries"}.` : "Nothing new to import."];
  if (duplicates) parts.push(`${duplicates} ${duplicates === 1 ? "was" : "were"} already there.`);
  const skipped = describeSkipped(result.skipped);
  if (skipped) parts.push(skipped);
  if (!fresh.length) return result.skipped.length && !duplicates ? fail(parts.join(" ")) : ok(parts.join(" "));
  return run(async () => void (await repo.createTransactions(fresh.map((t) => ({ ...t, invoiceId: null })))), parts.join(" "));
}

export async function stopRecurring(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  // Entries already added stay in the ledger; only future ones stop.
  await run(() => repo.deleteRecurring(id.data), "Stopped. Past entries are kept.");
}

export async function deleteTransaction(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo, today } = await getRepo();
  const tx = (await repo.listTransactions()).find((t) => t.id === id.data);
  if (!tx) return;
  // Income that came from a paid invoice: un-pay the invoice too, so the two never disagree.
  if (tx.invoiceId) await run(() => repo.setInvoiceStatus(tx.invoiceId!, "sent", today), "Invoice marked unpaid.");
  else await run(() => repo.deleteTransaction(id.data), "Deleted.");
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
  const { repo, currency: mine } = await getRepo();
  const picked = get(fd, "currency");
  if (picked && !(MONEY_CURRENCIES as readonly string[]).includes(picked)) return fail("Pick a supported currency.");
  const currency = picked || mine;
  const id = fd.get("id");
  if (id) {
    const pid = idSchema.safeParse(id);
    if (!pid.success) return fail("Invalid id.");
    return run(() => repo.updateInvoice(pid.data, { ...parsed.data, total }), "Invoice saved.");
  }
  return run(async () => void (await repo.createInvoice({ ...parsed.data, total, currency })), "Invoice created.");
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

export async function saveBusinessProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = businessInput.safeParse({
    businessName: get(fd, "businessName"),
    address: get(fd, "address"),
    taxId: get(fd, "taxId"),
    contactEmail: get(fd, "contactEmail"),
    phone: get(fd, "phone"),
    paymentDetails: get(fd, "paymentDetails"),
    defaultDueDays: get(fd, "defaultDueDays") ?? 14,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  return run(() => repo.saveBusinessProfile(parsed.data), "Invoice details saved.");
}

const repeatInvoiceInput = z.object({
  id: idSchema,
  cadence: z.enum(MONEY_CADENCES),
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of the next invoice."),
  autoSend: z.literal("on").optional(),
});

/** "Repeat this invoice": saves its client, items and terms as a schedule. Each occurrence becomes a new invoice. */
export async function repeatInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = repeatInvoiceInput.safeParse({ id: fd.get("id"), cadence: fd.get("cadence"), nextDate: fd.get("nextDate"), autoSend: fd.get("autoSend") ?? undefined });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo, today, demo } = await getRepo();
  const { user, profile } = await requireProfile();
  const [invoices, business] = await Promise.all([repo.listInvoices(), repo.getBusinessProfile()]);
  const inv = invoices.find((i) => i.id === parsed.data.id);
  if (!inv) return fail("That invoice no longer exists.");
  const { nextDate, cadence } = parsed.data;
  if (nextDate <= inv.issueDate) return fail("The next invoice must be dated after this one.");
  const dueDays = inv.dueDate ? Math.min(365, Math.max(0, daysBetween(inv.issueDate, inv.dueDate))) : business.defaultDueDays;
  try {
    await repo.createRecurringInvoice({ clientId: inv.clientId, projectId: inv.projectId, currency: inv.currency, items: inv.items, total: inv.total, notes: inv.notes, cadence, dueDays, autoSend: !!parsed.data.autoSend && !demo, startDate: nextDate, nextDate });
    // A next date of today (or earlier) is issued right away.
    if (nextDate <= today) await materializeRecurringInvoices(repo, today, { emailClients: !demo, senderName: profile.displayName, ownerEmail: async () => user.email || null, notifyUser: false });
  } catch (e) {
    if (e instanceof MissingMigrationError) return fail("Repeating invoices need a one-time database update: run supabase/migrations/0013_recurring_invoices.sql in the Supabase SQL Editor.");
    if (e instanceof Error && e.message === "Demo limit reached") return fail("Demo limit reached. Stop a repeating entry first.");
    console.error("[finance] repeat invoice failed:", e);
    return fail("Something went wrong. Please try again.");
  }
  refresh();
  return ok(`Saved: ${cadenceLabel[cadence].toLowerCase()}, ${nextDate <= today ? "and the next invoice was issued now" : `next invoice on ${nextDate}`}. Manage it under Invoices → Repeating.`);
}

export async function stopRecurringInvoice(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  // Invoices already issued stay; only future ones stop.
  await run(() => repo.deleteRecurringInvoice(id.data), "Stopped. Invoices already issued are kept.");
}

const sendInput = z.object({ id: idSchema, message: z.string().trim().max(1000).optional() });

/** Emails the invoice to the client's address; replies go to you. Marks a draft as sent. */
export async function sendInvoiceToClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = sendInput.safeParse({ id: fd.get("id"), message: fd.get("message") ?? undefined });
  if (!parsed.success) return fail("Invalid request.");
  const { repo, today, userId, demo } = await getRepo();
  const { user, profile } = await requireProfile();
  if (demo) return fail("Emails can't be sent in demo mode. Use Download PDF and send it yourself.");
  if (!emailConfigured()) return fail("Email sending isn't set up on this server yet.");
  if (!(await rateLimit(`invoice-email:${userId}`, 10, 60 * 60_000))) return fail("You've sent a lot of invoices this hour. Try again later.");

  const [invoices, clients, business] = await Promise.all([repo.listInvoices(), repo.listClients(), repo.getBusinessProfile()]);
  const inv = invoices.find((i) => i.id === parsed.data.id);
  if (!inv) return fail("That invoice no longer exists.");
  const client = inv.clientId ? clients.find((c) => c.id === inv.clientId) : undefined;
  if (!client?.email) return fail("Add an email address to this client first.");

  try {
    await emailInvoice({ invoice: inv, client, business, senderName: profile.displayName, replyTo: business.contactEmail ?? user.email, message: parsed.data.message || null });
  } catch (e) {
    console.error("[invoice] send failed:", e instanceof Error ? e.message : e);
    return fail("Couldn't send the email. Please try again.");
  }
  if (inv.status === "draft") await repo.setInvoiceStatus(inv.id, "sent", today);
  refresh();
  return ok(`Sent to ${client.email}.`);
}
