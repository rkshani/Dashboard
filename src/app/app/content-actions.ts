"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { NotFoundError } from "@/lib/data/repo";
import { CONTENT_STATUSES, contentInput, idSchema, type FormState } from "@/lib/data/types";

const ok = (message: string): FormState => ({ status: "success", message, at: Date.now() });
const fail = (message: string): FormState => ({ status: "error", message, at: Date.now() });
const get = (fd: FormData, k: string) => (fd.get(k) as string | null) ?? undefined;

export async function saveContent(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = contentInput.safeParse({
    title: get(fd, "title"),
    channel: get(fd, "channel"),
    date: get(fd, "date"),
    time: get(fd, "time"),
    status: get(fd, "status"),
    caption: get(fd, "caption"),
    campaignId: get(fd, "campaignId"),
    clientId: get(fd, "clientId"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { repo } = await getRepo();
  const rawId = fd.get("id");
  try {
    if (rawId) {
      const id = idSchema.safeParse(rawId);
      if (!id.success) return fail("Invalid id.");
      await repo.updateContent(id.data, parsed.data);
    } else await repo.createContent(parsed.data);
  } catch (e) {
    if (e instanceof NotFoundError) return fail("That item no longer exists.");
    if (e instanceof Error && e.message === "Demo limit reached") return fail("Demo limit reached.");
    throw e;
  }
  refresh();
  return ok(rawId ? "Saved." : "Added to your calendar.");
}

export async function setContentStatus(fd: FormData) {
  const parsed = z.object({ id: idSchema, status: z.enum(CONTENT_STATUSES) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  const { repo } = await getRepo();
  await repo.setContentStatus(parsed.data.id, parsed.data.status).catch(() => undefined);
  refresh();
}

export async function deleteContent(fd: FormData) {
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return;
  const { repo } = await getRepo();
  await repo.deleteContent(id.data);
  refresh();
}
