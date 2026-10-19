"use server";

import { refresh } from "next/cache";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
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

// ---------------- Clients ----------------

export async function saveClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = clientInput.safeParse(fields(fd, ["name", "company", "email", "phone", "status", "notes"]));
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

export async function deleteClient(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await run(() => repo.deleteClient(id.data), "Deleted.");
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
  await run(() => repo.deleteProject(id.data), "Deleted.");
}

// ---------------- Tasks ----------------

export async function addTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = taskInput.safeParse(fields(fd, ["title", "projectId", "dueDate", "priority"]));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  return run(async () => void (await repo.createTask(parsed.data)), "Task added.");
}

export async function toggleTask(fd: FormData) {
  const parsed = z.object({ id: idSchema, done: z.enum(["true", "false"]) }).safeParse({ id: fd.get("id"), done: fd.get("done") });
  if (!parsed.success) return;
  const { repo } = await getRepo();
  await run(() => repo.setTaskDone(parsed.data.id, parsed.data.done === "true"), "Updated.");
}

export async function deleteTask(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await run(() => repo.deleteTask(id.data), "Deleted.");
}
