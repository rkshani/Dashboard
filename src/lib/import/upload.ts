import "server-only";

// Server actions accept up to 1 MB; stay under it so the user gets our message, not a framework error.
const MAX_CSV_BYTES = 900_000;

/** Reads the "file" field of an import form, with friendly errors for the usual mistakes. */
export async function readCsvUpload(fd: FormData): Promise<{ text: string } | { error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_CSV_BYTES) return { error: "That file is over 900 KB. Split it into smaller files and import them one by one." };
  if (!/\.(csv|tsv|txt)$/i.test(file.name)) return { error: "That isn't a CSV file. In Excel or Google Sheets, save or download it as CSV first." };
  const text = await file.text();
  if (text.includes("\u0000")) return { error: "That looks like an Excel file renamed to .csv. Open it in Excel and save it as CSV." };
  return { text };
}

/** "Skipped 4: line 3 (no amount), line 7 (…), line 9 (…), …." */
export function describeSkipped(skipped: { line: number; reason: string }[]): string | null {
  if (!skipped.length) return null;
  const shown = skipped.slice(0, 3).map((s) => `line ${s.line} (${s.reason})`).join(", ");
  return `Skipped ${skipped.length}: ${shown}${skipped.length > 3 ? ", …" : ""}.`;
}
