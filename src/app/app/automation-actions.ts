"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { runAutomations } from "@/lib/automations/engine";
import { composeDigest } from "@/lib/automations/compose";
import { IMPLEMENTED_RULES } from "@/lib/automations/types";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { materializeRecurringInvoices } from "@/lib/recurring-invoices";
import type { FormState } from "@/lib/data/types";
import { getTemplate } from "@/templates";

const res = (status: FormState["status"], message: string): FormState => ({ status, message, at: Date.now() });

export async function toggleRule(fd: FormData) {
  const parsed = z.object({ id: z.string().regex(/^[a-z0-9-]{1,60}$/), on: z.enum(["true", "false"]) }).safeParse({ id: fd.get("id"), on: fd.get("on") });
  if (!parsed.success) return;
  const { repo } = await getRepo();
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  // Only rules that exist in the user's template and that the engine can run.
  if (!template.automations.some((a) => a.id === parsed.data.id) || !IMPLEMENTED_RULES.has(parsed.data.id)) return;
  const settings = await repo.getAutomationSettings();
  const on = parsed.data.on === "true";
  await repo.saveAutomationSettings({
    rules: { ...settings.rules, [parsed.data.id]: on },
    ...(parsed.data.id === "morning-digest" ? { digestEnabled: on } : {}),
  });
  refresh();
}

export async function saveDigestTime(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.coerce.number().int().min(0).max(23).safeParse(fd.get("hour"));
  if (!parsed.success) return res("error", "Pick an hour.");
  const { repo } = await getRepo();
  await repo.saveAutomationSettings({ digestHour: parsed.data });
  refresh();
  return res("success", "Saved.");
}

export async function runNow(_prev: FormState): Promise<FormState> {
  void _prev;
  const { repo, today, userId, demo } = await getRepo();
  if (!(await rateLimit(`automations:${userId}`, 6, 60_000))) return res("error", "Please wait a moment before running again.");
  const { user, profile } = await requireProfile();
  const ownerEmail = async () => user.email || null;
  const issued = await materializeRecurringInvoices(repo, today, { emailClients: !demo, senderName: profile.displayName, ownerEmail });
  const done = await runAutomations({ repo, profile, template: getTemplate(profile.templateId), today, emailClients: !demo, ownerEmail });
  const count = issued + done.length;
  refresh();
  return res("success", count ? `Done: ${count} action${count > 1 ? "s" : ""}. See the log below.` : "All caught up. Nothing new to do.");
}

export async function sendTestDigest(_prev: FormState): Promise<FormState> {
  void _prev;
  const { repo, today, userId, demo } = await getRepo();
  const { user, profile } = await requireProfile();
  if (demo) return res("error", "Emails can't be sent in demo mode. Use the preview instead.");
  if (!emailConfigured()) return res("error", "Email sending isn't set up on this server yet (see README).");
  if (!(await rateLimit(`digest-test:${userId}`, 3, 10 * 60_000))) return res("error", "You've sent a few tests already. Try again in a few minutes.");
  try {
    const { digest, html, text } = await composeDigest({ repo, profile, template: getTemplate(profile.templateId), today, ownerId: userId });
    await sendEmail({ to: user.email, subject: `[Test] ${digest.subject}`, html, text });
    return res("success", `Test digest sent to ${user.email}.`);
  } catch (e) {
    console.error("[digest] test failed:", e instanceof Error ? e.message : e);
    return res("error", "Couldn't send the email. Check the email settings.");
  }
}
