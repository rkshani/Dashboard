"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
import { ATTENDANCE, idSchema, slotInput, type FormState } from "@/lib/data/types";
import { monthLabel } from "@/lib/money";
import { FEE_CATEGORY, feeRows } from "@/lib/teaching/fees";

const ok = (message: string): FormState => ({ status: "success", message, at: Date.now() });
const fail = (message: string): FormState => ({ status: "error", message, at: Date.now() });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Records the rest of a student's fee for a month as income (never more than what's owed). */
export async function recordFee(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  const m = month.safeParse(fd.get("month"));
  if (!id.success || !m.success) return;
  const { repo, today, currency } = await getRepo();
  const [clients, txns] = await Promise.all([repo.listClients(), repo.listTransactions()]);
  const row = feeRows(clients.filter((c) => c.id === id.data), txns, m.data, today)[0];
  if (!row || row.status === "paid") return;
  const amount = Math.round((row.fee - row.paid) * 100) / 100;
  await repo.createTransaction({ kind: "income", amount, currency, category: FEE_CATEGORY, date: today, note: `Fee for ${monthLabel(m.data)} (${m.data})`, clientId: row.student.id, projectId: row.student.classId });
  refresh();
}

export async function saveAttendance(_prev: FormState, fd: FormData): Promise<FormState> {
  const d = date.safeParse(fd.get("date"));
  const cls = z.union([idSchema, z.literal("")]).safeParse(fd.get("classId") ?? "");
  if (!d.success || !cls.success) return fail("Pick a valid date.");
  const { repo, today } = await getRepo();
  if (d.data > today) return fail("You can't mark attendance for a future date.");
  const known = new Set((await repo.listClients()).map((c) => c.id));
  const marks: { clientId: string; status: (typeof ATTENDANCE)[number] }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("s:")) continue;
    const clientId = k.slice(2);
    const status = z.enum(ATTENDANCE).safeParse(v);
    if (idSchema.safeParse(clientId).success && known.has(clientId) && status.success) marks.push({ clientId, status: status.data });
  }
  if (!marks.length) return fail("Mark at least one student.");
  if (marks.length > 300) return fail("Too many students in one go.");
  await repo.saveAttendance(d.data, cls.data || null, marks);
  refresh();
  const absent = marks.filter((m) => m.status === "absent").length;
  return ok(`Saved ${marks.length} ${marks.length === 1 ? "mark" : "marks"}${absent ? `, ${absent} absent` : ""}.`);
}

export async function addSlot(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = slotInput.safeParse({ classId: fd.get("classId"), weekday: fd.get("weekday"), start: fd.get("start"), end: fd.get("end"), location: fd.get("location") ?? undefined });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  try {
    await repo.createSlot(parsed.data);
  } catch (e) {
    if (e instanceof NotFoundError) return fail("That class no longer exists.");
    if (e instanceof Error && e.message === "Demo limit reached") return fail("Demo limit reached.");
    throw e;
  }
  refresh();
  return ok("Added to your timetable.");
}

export async function deleteSlot(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await repo.deleteSlot(id.data);
  refresh();
}
