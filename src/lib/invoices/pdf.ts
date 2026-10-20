import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { BusinessProfile, Client, Invoice } from "@/lib/data/types";

/**
 * The invoice as a real PDF file: for the "Download PDF" button and as the attachment on invoice
 * and reminder emails. Laid out to match the invoice page. Uses the built-in Helvetica, so it needs
 * no font files; characters Helvetica can't draw (₹, or non-Latin scripts) are swapped for a
 * readable stand-in rather than breaking the file.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = 56; // page margin
const INK = rgb(0.067, 0.094, 0.153);
const MUTED = rgb(0.42, 0.447, 0.502);
const LINE = rgb(0.898, 0.906, 0.922);
const BOX = rgb(0.957, 0.965, 0.98);

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

/** "INV-0042.pdf", safe as a download or attachment name. */
export const invoicePdfName = (inv: Pick<Invoice, "number">) => `${inv.number.replace(/[^\w.-]+/g, "_") || "invoice"}.pdf`;

/** Keeps only what Helvetica (WinAnsi) can draw. */
export function pdfSafe(s: string, font: PDFFont): string {
  const out: string[] = [];
  for (const ch of s.replace(/₹/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, " ")) {
    try {
      font.encodeText(ch);
      out.push(ch);
    } catch {
      out.push("?");
    }
  }
  return out.join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        // A single word longer than the line (a long URL or IBAN) is cut to fit.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf(input: {
  invoice: Invoice;
  client: Pick<Client, "name" | "company" | "email"> | null;
  business: BusinessProfile;
  senderName: string;
  senderEmail: string | null;
  money: (amount: number, currency: string) => string;
}): Promise<Uint8Array> {
  const { invoice: inv, client, business: b, money } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setAuthor(b.businessName || input.senderName);
  doc.setCreator("Dashboard");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const right = A4.w - M;
  const width = right - M;

  const text = (s: string, x: number, at: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    const safe = pdfSafe(s, font);
    const dx = o.align === "right" ? font.widthOfTextAtSize(safe, size) : 0;
    page.drawText(safe, { x: x - dx, y: at, size, font, color: o.color ?? INK });
  };
  const newPageIfNeeded = (space: number) => {
    if (y - space >= M) return false;
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
    text(`Invoice ${inv.number} (continued)`, M, y, { color: MUTED, size: 9 });
    y -= 24;
    return true;
  };
  const block = (label: string, lines: string[], x: number, top: number, colWidth: number) => {
    text(label.toUpperCase(), x, top, { size: 8, color: MUTED });
    let at = top - 16;
    lines.forEach((l, i) => {
      for (const part of wrap(pdfSafe(l, i === 0 ? bold : regular), i === 0 ? bold : regular, i === 0 ? 11 : 9.5, colWidth)) {
        text(part, x, at, { font: i === 0 ? bold : regular, size: i === 0 ? 11 : 9.5, color: i === 0 ? INK : MUTED });
        at -= i === 0 ? 15 : 13;
      }
    });
    return at;
  };

  // Header
  text("Invoice", M, y - 20, { font: bold, size: 26 });
  text(inv.number, M, y - 40, { size: 10, color: MUTED });
  if (inv.status === "paid") text("PAID", right, y - 20, { font: bold, size: 14, color: rgb(0.13, 0.55, 0.33), align: "right" });
  y -= 80;

  // From / Bill to
  const col = width / 2 - 12;
  const replyEmail = b.contactEmail ?? input.senderEmail;
  const from = [b.businessName || input.senderName, ...(b.address ? b.address.split(/\r?\n/) : []), ...(b.taxId ? [`Tax ID: ${b.taxId}`] : []), ...(replyEmail ? [replyEmail] : []), ...(b.phone ? [b.phone] : [])];
  const to = [client?.name ?? "-", ...(client?.company ? [client.company] : []), ...(client?.email ? [client.email] : [])];
  y = Math.min(block("From", from, M, y, col), block("Bill to", to, M + width / 2 + 12, y, col)) - 14;

  // Dates
  const paid = inv.status === "paid" && inv.paidAt;
  block("Issued", [fmtDate(inv.issueDate)], M, y, col);
  block(paid ? "Paid" : "Due", [paid ? fmtDate(inv.paidAt!) : inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"], M + width / 2 + 12, y, col);
  y -= 50;

  // Items
  const cols = { qty: right - 190, rate: right - 95, amount: right };
  const descWidth = cols.qty - 50 - M;
  const tableHeader = () => {
    text("DESCRIPTION", M, y, { size: 8, color: MUTED });
    text("QTY", cols.qty, y, { size: 8, color: MUTED, align: "right" });
    text("RATE", cols.rate, y, { size: 8, color: MUTED, align: "right" });
    text("AMOUNT", cols.amount, y, { size: 8, color: MUTED, align: "right" });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 0.8, color: LINE });
    y -= 18;
  };
  tableHeader();
  for (const it of inv.items) {
    const lines = wrap(pdfSafe(it.description, regular), regular, 10, descWidth);
    if (newPageIfNeeded(lines.length * 13 + 14)) tableHeader();
    text(String(it.quantity), cols.qty, y, { align: "right" });
    text(money(it.rate, inv.currency), cols.rate, y, { align: "right" });
    text(money(it.quantity * it.rate, inv.currency), cols.amount, y, { align: "right" });
    for (const l of lines) {
      text(l, M, y);
      y -= 13;
    }
    y -= 1;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: LINE });
    y -= 10;
  }
  newPageIfNeeded(40);
  y -= 8;
  text("Total", cols.rate - 60, y, { font: bold, size: 13, align: "right" });
  text(money(inv.total, inv.currency), cols.amount, y, { font: bold, size: 13, align: "right" });
  y -= 36;

  // How to pay
  if (b.paymentDetails) {
    const lines = wrap(pdfSafe(b.paymentDetails, regular), regular, 9.5, width - 28);
    const h = 34 + lines.length * 13;
    newPageIfNeeded(h + 10);
    page.drawRectangle({ x: M, y: y - h + 12, width, height: h, color: BOX });
    text("HOW TO PAY", M + 14, y - 6, { size: 8, color: MUTED });
    let at = y - 24;
    for (const l of lines) {
      text(l, M + 14, at, { size: 9.5 });
      at -= 13;
    }
    y -= h + 14;
  }

  // Notes
  if (inv.notes) {
    for (const l of wrap(pdfSafe(inv.notes, regular), regular, 9.5, width)) {
      newPageIfNeeded(14);
      text(l, M, y, { size: 9.5, color: MUTED });
      y -= 13;
    }
  }

  return doc.save();
}
