import { findColumns } from "@/lib/csv";
import { clientInput, type ClientInput, type ClientStatus } from "@/lib/data/types";

/**
 * Turns CSV rows (a contact list, or a teacher's student list) into clients. Columns are found by
 * header name. People already in the app, matched by email or else by name, are skipped.
 */

export type ClientImportResult = { rows: ClientInput[]; skipped: { line: number; reason: string }[]; duplicates: number; error?: string };

const HEADERS = {
  name: ["name", "client", "client name", "full name", "student", "student name", "contact", "contact name", "customer", "customer name", "display name"],
  // Google Contacts and Outlook exports split the name.
  firstName: ["first name", "given name"],
  lastName: ["last name", "family name", "surname"],
  company: ["company", "company name", "organisation", "organization", "organization name", "organization 1 - name", "business", "guardian", "guardian name", "parent", "parent name"],
  email: ["email", "e-mail", "email address", "mail", "e-mail 1 - value", "email 1 - value", "e-mail address"],
  phone: ["phone", "phone number", "mobile", "mobile number", "mobile phone", "primary phone", "phone 1 - value", "contact number", "cell", "whatsapp", "tel", "telephone"],
  notes: ["notes", "note", "remarks", "comments", "description"],
  status: ["status", "stage"],
  monthlyFee: ["monthly fee", "fee", "fees", "monthly"],
  feeDueDay: ["due day", "fee due day", "due on", "due"],
} as const;

function status(v: string): ClientStatus | null {
  const s = v.trim().toLowerCase();
  if (!s || /^(active|current|ongoing|client|yes)$/.test(s)) return "active";
  if (/^(lead|prospect|potential|new)$/.test(s)) return "lead";
  if (/^(past|former|inactive|old|archived|ended|no)$/.test(s)) return "past";
  return null;
}

/** Same person = same email, or (with no email) the same name. */
export const clientKey = (c: { name: string; email: string | null }) => (c.email ? `e:${c.email.toLowerCase()}` : `n:${c.name.trim().toLowerCase()}`);

export function mapClients(rows: string[][], existing: { name: string; email: string | null }[], maxRows = 1000): ClientImportResult {
  const [header, ...body] = rows;
  if (!header) return { rows: [], skipped: [], duplicates: 0, error: "The file is empty." };
  const col = findColumns(header, HEADERS);
  if (col.name === undefined && col.firstName === undefined) return { rows: [], skipped: [], duplicates: 0, error: 'No "Name" column found. Add a header row with at least a Name column.' };
  if (body.length > maxRows) return { rows: [], skipped: [], duplicates: 0, error: `That's ${body.length} rows. Import up to ${maxRows} at a time.` };

  const at = (r: string[], f: keyof typeof HEADERS) => (col[f] === undefined ? "" : (r[col[f]!] ?? "").trim());
  const known = new Set(existing.map(clientKey));
  const out: ClientInput[] = [];
  const skipped: ClientImportResult["skipped"] = [];
  let duplicates = 0;
  body.forEach((r, idx) => {
    const line = idx + 2;
    const st = status(at(r, "status"));
    if (!st) return skipped.push({ line, reason: `unknown status "${at(r, "status").slice(0, 20)}" (use lead, active or past)` });
    const valid = clientInput.safeParse({
      name: at(r, "name") || [at(r, "firstName"), at(r, "lastName")].filter(Boolean).join(" "),
      company: at(r, "company") || undefined,
      email: at(r, "email") || undefined,
      phone: at(r, "phone") || undefined,
      notes: at(r, "notes") || undefined,
      status: st,
      monthlyFee: at(r, "monthlyFee").replace(/[^\d.]/g, "") || undefined,
      feeDueDay: at(r, "feeDueDay").replace(/\D/g, "") || undefined,
    });
    if (!valid.success) return skipped.push({ line, reason: valid.error.issues[0].message.replace(/\.$/, "").toLowerCase() });
    const key = clientKey(valid.data);
    if (known.has(key)) return void duplicates++;
    known.add(key);
    out.push(valid.data);
  });
  return { rows: out, skipped, duplicates };
}
