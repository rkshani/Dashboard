"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
import { businessInput, idSchema, INVOICE_STATUSES, invoiceInput, invoiceTotal, moneyRepeatInput, transactionInput, type FormState } from "@/lib/data/types";
import { requireProfile } from "@/lib/auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { renderInvoiceEmail } from "@/lib/invoices/email";
import { fmtMoney } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import type { MoneyCadence } from "@/lib/recurrence";
import { materializeRecurring } from "@/lib/recurring";
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
    await materializeRecurring(repo, today);
  }, date > today ? `Repeating ${noun} saved. The first one is added on ${date}.` : `Repeating ${noun} saved and added.`);
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

const sendInput = z.object({ id: idSchema, message: z.string().trim().max(1000).optional() });

/** Emails the invoice to the client's address; replies go to you. Marks a draft as sent. */
export async function sendInvoiceToClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = sendInput.safeParse({ id: fd.get("id"), message: fd.get("message") ?? undefined });
  if (!parsed.success) return fail("Invalid request.");
  const { repo, today, userId, demo } = await getRepo();
  const { user, profile } = await requireProfile();
  if (demo) return fail("Emails can't be sent in demo mode. Use Print / save as PDF instead.");
  if (!emailConfigured()) return fail("Email sending isn't set up on this server yet.");
  if (!rateLimit(`invoice-email:${userId}`, 10, 60 * 60_000)) return fail("You've sent a lot of invoices this hour. Try again later.");

  const [invoices, clients, business] = await Promise.all([repo.listInvoices(), repo.listClients(), repo.getBusinessProfile()]);
  const inv = invoices.find((i) => i.id === parsed.data.id);
  if (!inv) return fail("That invoice no longer exists.");
  const client = inv.clientId ? clients.find((c) => c.id === inv.clientId) : undefined;
  if (!client?.email) return fail("Add an email address to this client first.");

  const { subject, html, text } = renderInvoiceEmail({ invoice: inv, client, business, senderName: profile.displayName, money: fmtMoney, message: parsed.data.message || null });
  try {
    await sendEmail({ to: client.email, subject, html, text, replyTo: business.contactEmail ?? user.email });
  } catch (e) {
    console.error("[invoice] send failed:", e instanceof Error ? e.message : e);
    return fail("Couldn't send the email. Please try again.");
  }
  if (inv.status === "draft") await repo.setInvoiceStatus(inv.id, "sent", today);
  refresh();
  return ok(`Sent to ${client.email}.`);
}
