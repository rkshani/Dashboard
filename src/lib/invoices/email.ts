/**
 * Invoice email for the client. Pure function (unit-tested): every value is escaped,
 * so a client name or line item can't inject HTML into the email.
 */
import type { BusinessProfile, Client, Invoice } from "@/lib/data/types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

export function renderInvoiceEmail(input: {
  invoice: Invoice;
  client: Pick<Client, "name" | "company"> | null;
  business: BusinessProfile;
  senderName: string;
  money: (amount: number, currency: string) => string;
  message?: string | null;
}) {
  const { invoice: inv, client, business: b, money } = input;
  const from = b.businessName || input.senderName;
  const due = inv.dueDate ? fmtDate(inv.dueDate) : "on receipt";
  const subject = `Invoice ${inv.number} from ${from}: ${money(inv.total, inv.currency)}, due ${due}`;

  const rows = inv.items
    .map(
      (it) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f4;font:14px Arial,sans-serif;color:#111827">${esc(it.description)}</td>` +
        `<td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #eef0f4;font:13px Arial,sans-serif;color:#6b7280;white-space:nowrap">${esc(String(it.quantity))} × ${esc(money(it.rate, inv.currency))}</td>` +
        `<td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #eef0f4;font:14px Arial,sans-serif;color:#111827;white-space:nowrap">${esc(money(it.quantity * it.rate, inv.currency))}</td></tr>`,
    )
    .join("");

  const fromLines = [b.address, b.taxId ? `Tax ID: ${b.taxId}` : null, b.contactEmail, b.phone].filter(Boolean) as string[];

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font:700 24px Arial,sans-serif;color:#111827">Invoice ${esc(inv.number)}</td></tr>
<tr><td style="padding-top:6px;font:14px Arial,sans-serif;color:#6b7280">Issued ${esc(fmtDate(inv.issueDate))} · Due ${esc(due)}</td></tr>
${input.message ? `<tr><td style="padding-top:20px;font:14px/1.6 Arial,sans-serif;color:#374151">${nl2br(input.message)}</td></tr>` : ""}
<tr><td style="padding-top:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="50%" style="font:12px/1.6 Arial,sans-serif;color:#6b7280">FROM<br><span style="font:600 14px Arial,sans-serif;color:#111827">${esc(from)}</span>${fromLines.length ? `<br>${fromLines.map(nl2br).join("<br>")}` : ""}</td>
<td valign="top" width="50%" style="font:12px/1.6 Arial,sans-serif;color:#6b7280">BILL TO<br><span style="font:600 14px Arial,sans-serif;color:#111827">${esc(client?.name ?? "—")}</span>${client?.company ? `<br>${esc(client.company)}` : ""}</td>
</tr></table></td></tr>
<tr><td style="padding-top:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
<tr><td colspan="2" align="right" style="padding-top:14px;font:600 15px Arial,sans-serif;color:#111827">Total</td><td align="right" style="padding:14px 0 0 12px;font:700 16px Arial,sans-serif;color:#111827;white-space:nowrap">${esc(money(inv.total, inv.currency))}</td></tr>
</table></td></tr>
${b.paymentDetails ? `<tr><td style="padding-top:24px"><div style="background:#f4f6fa;border-radius:10px;padding:14px;font:13px/1.6 Arial,sans-serif;color:#374151"><strong style="color:#111827">How to pay</strong><br>${nl2br(b.paymentDetails)}</div></td></tr>` : ""}
${inv.notes ? `<tr><td style="padding-top:16px;font:13px/1.6 Arial,sans-serif;color:#6b7280">${nl2br(inv.notes)}</td></tr>` : ""}
<tr><td style="padding-top:24px;font:12px Arial,sans-serif;color:#9ca3af">Reply to this email with any questions about this invoice.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Invoice ${inv.number} from ${from}`,
    `Issued ${fmtDate(inv.issueDate)}, due ${due}`,
    "",
    ...(input.message ? [input.message, ""] : []),
    ...inv.items.map((it) => `- ${it.description}: ${it.quantity} x ${money(it.rate, inv.currency)} = ${money(it.quantity * it.rate, inv.currency)}`),
    `Total: ${money(inv.total, inv.currency)}`,
    ...(b.paymentDetails ? ["", "How to pay:", b.paymentDetails] : []),
    ...(inv.notes ? ["", inv.notes] : []),
    "",
    `From: ${[from, ...fromLines].join(", ")}`,
  ].join("\n");

  return { subject, html, text };
}
