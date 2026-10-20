import "server-only";

/** Sends email through Resend's HTTP API. Configure RESEND_API_KEY and DIGEST_FROM_EMAIL. */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; replyTo?: string | null }) {
  if (!emailConfigured()) throw new Error("Email is not configured");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to)) throw new Error("Invalid recipient");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM_EMAIL,
      to: [msg.to],
      subject: msg.subject.slice(0, 200),
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.replyTo) ? { reply_to: msg.replyTo } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}`);
}
