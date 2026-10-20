"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getRepo } from "@/lib/data";
import { NotFoundError, type Repo } from "@/lib/data/repo";
import { parseCsv } from "@/lib/csv";
import { mapClients } from "@/lib/import/clients";
import { describeSkipped, readCsvUpload } from "@/lib/import/upload";
import { rateLimit } from "@/lib/rate-limit";
import { nextTaskDate } from "@/lib/recurrence";
import { clientInput, idSchema, PROJECT_STATUSES, projectInput, taskInput, type FormState } from "@/lib/data/types";
import { z } from "zod";

/**
 * Every action re-checks the session through getRepo() (server actions are public
 * POST endpoints), validates all input with zod, and refreshes the page on success.
 */

const ok = (message: string): FormState => ({ status: "success", message, at: Date.now() });
const fail = (message: string): FormState => ({ status: "error", message, at: Date.now() });

function fields(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, (fd.get(k) as string | null) ?? undefined]));
}

async function run(fn: () => Promise<void>, success: string): Promise<FormState> {
  try {
    await fn();
    refresh();
    return ok(success);
  } catch (e) {
    if (e instanceof NotFoundError) return fail("That item no longer exists.");
    if (e instanceof Error && e.message === "Demo limit reached") return fail("Demo limit reached. Delete something first.");
    // Redirects (e.g. signed out) must propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e);
    return fail("Something went wrong. Please try again.");
  }
}

/** After deleting from a detail page, go back to its list. Only fixed in-app paths are allowed. */
const AFTER_DELETE = new Set(["/app/clients", "/app/students", "/app/projects"]);
function goAfterDelete(fd: FormData) {
  const to = fd.get("then");
  if (typeof to === "string" && AFTER_DELETE.has(to)) redirect(to);
}

// ---------------- Clients ----------------

export async function saveClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = clientInput.safeParse(fields(fd, ["name", "company", "email", "phone", "status", "notes", "monthlyFee", "feeDueDay", "classId"]));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const id = fd.get("id");
  const { repo } = await getRepo();
  if (id) {
    const pid = idSchema.safeParse(id);
    if (!pid.success) return fail("Invalid id.");
    return run(() => repo.updateClient(pid.data, parsed.data), "Saved.");
  }
  return run(async () => void (await repo.createClient(parsed.data)), "Added.");
}

/** CSV contact or student list → clients. People already added (same email, or same name) are skipped. */
export async function importClientsCsv(_prev: FormState, fd: FormData): Promise<FormState> {
  const { repo, userId } = await getRepo();
  if (!(await rateLimit(`csv-import:${userId}`, 10, 3_600_000))) return fail("You've imported a lot this hour. Try again later.");
  const upload = await readCsvUpload(fd);
  if ("error" in upload) return fail(upload.error);
  const result = mapClients(parseCsv(upload.text, 1001), await repo.listClients());
  if (result.error) return fail(result.error);
  const n = result.rows.length;
  const parts = [n ? `Imported ${n}.` : "Nothing new to import."];
  if (result.duplicates) parts.push(`${result.duplicates} ${result.duplicates === 1 ? "was" : "were"} already there.`);
  const skipped = describeSkipped(result.skipped);
  if (skipped) parts.push(skipped);
  if (!n) return result.skipped.length && !result.duplicates ? fail(parts.join(" ")) : ok(parts.join(" "));
  return run(async () => void (await repo.createClients(result.rows)), parts.join(" "));
}

export async function deleteClient(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  const r = await run(() => repo.deleteClient(id.data), "Deleted.");
  if (r.status === "success") goAfterDelete(fd);
}

// ---------------- Projects ----------------

export async function saveProject(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = projectInput.safeParse(fields(fd, ["title", "clientId", "status", "deadline", "budget", "description"]));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const id = fd.get("id");
  const { repo } = await getRepo();
  if (id) {
    const pid = idSchema.safeParse(id);
    if (!pid.success) return fail("Invalid id.");
    return run(() => repo.updateProject(pid.data, parsed.data), "Saved.");
  }
  return run(async () => void (await repo.createProject(parsed.data)), "Added.");
}

export async function moveProject(fd: FormData) {
  const parsed = z.object({ id: idSchema, status: z.enum(PROJECT_STATUSES) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  const { repo } = await getRepo();
  await run(() => repo.setProjectStatus(parsed.data.id, parsed.data.status), "Moved.");
}

export async function deleteProject(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  const r = await run(() => repo.deleteProject(id.data), "Deleted.");
  if (r.status === "success") goAfterDelete(fd);
}

// ---------------- Tasks ----------------

export async function addTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = taskInput.safeParse(fields(fd, ["title", "projectId", "dueDate", "priority", "repeat"]));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  return run(async () => void (await repo.createTask(parsed.data)), "Task added.");
}

export async function updateTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid id.");
  const parsed = taskInput.safeParse(fields(fd, ["title", "projectId", "dueDate", "priority", "repeat"]));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  return run(() => repo.updateTask(id.data, parsed.data), "Saved.");
}

export async function toggleTask(fd: FormData) {
  const parsed = z.object({ id: idSchema, done: z.enum(["true", "false"]) }).safeParse({ id: fd.get("id"), done: fd.get("done") });
  if (!parsed.success) return;
  const { repo, today } = await getRepo();
  const done = parsed.data.done === "true";
  await run(async () => {
    await repo.setTaskDone(parsed.data.id, done);
    if (done) await scheduleNext(repo, parsed.data.id, today);
  }, "Updated.");
}

/** Finishing a repeating task creates the next one (once, even if it is ticked, unticked and ticked again). */
async function scheduleNext(repo: Repo, id: string, today: string) {
  const tasks = await repo.listTasks();
  const t = tasks.find((x) => x.id === id);
  if (!t || t.repeat === "none") return;
  const next = nextTaskDate(t.repeat, t.dueDate, today);
  if (!next) return;
  const exists = tasks.some((x) => !x.done && x.repeat === t.repeat && x.title === t.title && x.projectId === t.projectId && x.dueDate === next);
  if (!exists) await repo.createTask({ title: t.title, projectId: t.projectId, dueDate: next, priority: t.priority, repeat: t.repeat });
}

export async function deleteTask(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await run(() => repo.deleteTask(id.data), "Deleted.");
}
