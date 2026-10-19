"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { getCalendar } from "@/lib/calendar";
import { decrypt } from "@/lib/crypto";
import { revoke } from "@/lib/google/calendar";
import type { FormState } from "@/lib/data/types";

const eventInput = z.object({
  title: z.string().trim().min(1, "Give the event a title.").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  startTime: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Pick a valid time."),
  durationMin: z.coerce.number().int().min(5).max(24 * 60).default(60),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function createCalendarEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = eventInput.safeParse({
    title: fd.get("title"),
    date: fd.get("date"),
    startTime: fd.get("allDay") === "on" ? "" : (fd.get("startTime") ?? ""),
    durationMin: fd.get("durationMin") ?? 60,
    description: fd.get("description") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message, at: Date.now() };
  const { repo, userId, timezone } = await getRepo();
  const cal = await getCalendar(repo, userId, timezone);
  if (cal.state.mode !== "google" && cal.state.mode !== "demo") return { status: "error", message: "Connect Google Calendar first.", at: Date.now() };
  try {
    await cal.create(parsed.data);
    refresh();
    return { status: "success", message: cal.state.mode === "google" ? "Added to Google Calendar." : "Event added.", at: Date.now() };
  } catch (e) {
    console.error("[calendar] create failed:", e instanceof Error ? e.message : e);
    return { status: "error", message: "Couldn't create the event. Try reconnecting your calendar.", at: Date.now() };
  }
}

export async function disconnectGoogle() {
  const { repo, userId, demo } = await getRepo();
  if (demo) return;
  const integration = await repo.getIntegration("google");
  if (integration) {
    try {
      await revoke(decrypt(integration.refreshTokenEnc, userId));
    } catch {
      /* token unreadable or already revoked: deleting is still right */
    }
    await repo.deleteIntegration("google");
  }
  refresh();
}
