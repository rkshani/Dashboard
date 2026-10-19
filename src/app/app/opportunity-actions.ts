"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { POSTING_ID } from "@/lib/opportunities/feed";
import { PIPELINE_STATUSES } from "@/lib/opportunities/types";
import { getTemplate } from "@/templates";

const input = z.object({
  id: z.string().regex(POSTING_ID),
  status: z.enum(PIPELINE_STATUSES),
  title: z.string().max(200).optional(),
});

export async function setOpportunityStatus(fd: FormData) {
  const parsed = input.safeParse({ id: fd.get("id"), status: fd.get("status"), title: fd.get("title") ?? undefined });
  if (!parsed.success) return;
  const { repo, today } = await getRepo();
  const { profile } = await requireProfile();

  // Only act on postings that actually exist in this user's feed.
  const postings = await repo.listPostings();
  const posting = postings.find((p) => p.id === parsed.data.id);
  if (!posting) return;

  await repo.setOpportunityStatus(posting.id, parsed.data.status);

  // Built-in automation: marking a lead "Contacted" schedules a follow-up task in 3 days.
  const template = getTemplate(profile.templateId);
  const followUp = template.automations.find((a) => a.id === "contacted-followup")?.enabledByDefault;
  if (parsed.data.status === "contacted" && followUp) {
    await repo.createTask({ title: `Follow up: ${posting.title} (${posting.company})`.slice(0, 200), projectId: null, dueDate: addDays(today, 3), priority: "high" });
  }
  refresh();
}
