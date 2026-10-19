import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML → plain text. Source descriptions are untrusted and must never be rendered as HTML. */
export function stripHtml(html: string | null | undefined, max = 4000): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      if (k.startsWith("#x")) return safeChar(parseInt(k.slice(2), 16));
      if (k.startsWith("#")) return safeChar(parseInt(k.slice(1), 10));
      return m;
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeChar(code: number) {
  return Number.isFinite(code) && code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
}

export function clean(s: unknown, max = 200): string {
  return typeof s === "string" ? stripHtml(s, max).replace(/\s+/g, " ").trim() : "";
}

/** Only allow http(s) links (blocks javascript:, data: and similar). */
export function safeUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(sr|snr)\b\.?/g, "senior")
    .replace(/\b(jr)\b\.?/g, "junior")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

export function fingerprint(company: string, title: string) {
  const key = `${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}|${normalizeTitle(title)}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function toIso(v: unknown): string {
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return new Date().toISOString();
}

export function looksRemote(...parts: (string | undefined | null)[]) {
  return /\b(remote|anywhere|worldwide|work from home|wfh|distributed)\b/i.test(parts.filter(Boolean).join(" "));
}
