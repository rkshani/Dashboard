import "server-only";
import type { BusinessProfile, Client, Invoice } from "@/lib/data/types";
import { sendEmail } from "@/lib/email";
import { fmtMoney } from "@/lib/money";
import { renderInvoiceEmail } from "./email";
import { invoicePdfName, renderInvoicePdf } from "./pdf";

/**
 * Emails an invoice to its client with the PDF attached. Used when the user clicks send, by the
 * payment reminder automation, and by auto-sent repeating invoices. Replies go to the user.
 */
export async function emailInvoice(o: {
  invoice: Invoice;
  client: Pick<Client, "name" | "company" | "email">;
  business: BusinessProfile;
  senderName: string;
  /** Where the client's replies go: the business email, else the account email. */
  replyTo: string;
  message?: string | null;
  subject?: string;
}) {
  if (!o.client.email) throw new Error("Client has no email");
  const { subject, html, text } = renderInvoiceEmail({ invoice: o.invoice, client: o.client, business: o.business, senderName: o.senderName, money: fmtMoney, message: o.message ?? null });
  const pdf = await renderInvoicePdf({ invoice: o.invoice, client: o.client, business: o.business, senderName: o.senderName, senderEmail: o.replyTo, money: fmtMoney });
  await sendEmail({ to: o.client.email, subject: o.subject ?? subject, html, text, replyTo: o.replyTo, attachments: [{ filename: invoicePdfName(o.invoice), content: pdf }] });
}
