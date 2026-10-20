"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import type { FormState } from "@/lib/data/types";
import { getFeed, POSTING_ID } from "@/lib/opportunities/feed";
import { aiConfigured, draftProposal } from "@/lib/proposals/draft";
import { rateLimit } from "@/lib/rate-limit";
import { getTemplate } from "@/templates";

const ok = (message: string): FormState => ({ status: "success", message, at: Date.now() });
const fail = (message: string): FormState => ({ status: "error", message, at: Date.now() });
const postingId = z.string().regex(POSTING_ID);

export async function generateProposal(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = postingId.safeParse(fd.get("postingId"));
  const notes = z.string().trim().max(500).safeParse(fd.get("notes") ?? "");
  if (!id.success || !notes.success) return fail("Invalid request.");
  const { repo, userId } = await getRepo();
  const { profile } = await requireProfile();
  // AI drafts cost money, so cap them per user per day; template drafts are free.
  if (aiConfigured() && !rateLimit(`proposal:${userId}`, 20, 86_400_000)) return fail("You've drafted 20 proposals today. Edit an existing draft, or try again tomorrow.");
  const item = (await getFeed(repo, profile)).find((o) => o.id === id.data);
  if (!item) return fail("That posting is no longer in your feed.");
  const business = await repo.getBusinessProfile();
  const { text, source } = await draftProposal({ posting: item, profile, template: getTemplate(profile.templateId), business, matchedSkills: item.matchedSkills, notes: notes.data || undefined });
  await repo.saveProposal(item.id, text, source);
  refresh();
  return ok(source === "ai" ? "New draft ready. Read it through and make it yours." : "Draft ready from the template. Edit it before sending.");
}

export async function saveProposalText(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = postingId.safeParse(fd.get("postingId"));
  const body = z.string().trim().min(1, "The draft is empty.").max(5000, "Keep it under 5,000 characters.").safeParse(fd.get("body"));
  if (!id.success) return fail("Invalid request.");
  if (!body.success) return fail(body.error.issues[0].message);
  const { repo } = await getRepo();
  if (!(await repo.getPosting(id.data))) return fail("That posting no longer exists.");
  await repo.saveProposal(id.data, body.data, "edited");
  refresh();
  return ok("Saved.");
}
