/**
 * Small CSV reader and writer (RFC 4180): quoted fields, "" escapes, line breaks inside quotes,
 * CRLF, a UTF-8 BOM, and comma, semicolon or tab separators (Excel in many locales uses ";").
 */

export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (d: string) => firstLine.split(d).length - 1;
  return [",", ";", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

export function parseCsv(input: string, maxRows = 10_000): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') [field, i] = [field + '"', i + 1];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) [row, field] = [[...row, field], ""];
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, field]);
      [row, field] = [[], ""];
      if (rows.length > maxRows) break;
    } else field += c;
  }
  if (field !== "" || row.length) rows.push([...row, field]);
  // Drop blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/**
 * Finds which column holds each field from a list of accepted header names, case-insensitively.
 * Brackets are ignored ("Amount (PKR)" counts as "amount"), and each column is used once.
 */
export function findColumns<F extends string>(header: string[], names: Record<F, readonly string[]>): Partial<Record<F, number>> {
  const norm = header.map((h) => h.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[_.]/g, " ").replace(/\s+/g, " ").trim());
  const out: Partial<Record<F, number>> = {};
  for (const field of Object.keys(names) as F[]) {
    const i = norm.findIndex((h, idx) => names[field].includes(h) && !Object.values(out).includes(idx));
    if (i >= 0) out[field] = i;
  }
  return out;
}

/** Quotes a value when needed. Values starting with = + - @ are prefixed with ' so spreadsheets don't run them as formulas. */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
