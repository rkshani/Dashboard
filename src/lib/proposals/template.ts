import type { BusinessProfile } from "@/lib/data/types";
import type { Posting } from "@/lib/opportunities/types";
import type { Profile } from "@/lib/profile";
import type { Template } from "@/templates";

/** A no-AI draft built only from facts we have. Pure, so it is unit tested. */
export function templateProposal(i: { posting: Posting; profile: Profile; template: Template; business: BusinessProfile; matchedSkills: string[]; notes?: string }) {
  const p = i.posting;
  const first = i.profile.displayName.split(" ")[0];
  const skills = (i.matchedSkills.length ? i.matchedSkills : i.profile.skills).slice(0, 4);
  const list = skills.length > 1 ? `${skills.slice(0, -1).join(", ")} and ${skills[skills.length - 1]}` : skills[0];
  const lead = p.kind === "lead";
  const lines = [
    `Hi ${p.company} team,`,
    "",
    lead
      ? `I read your post about "${p.title}" and I'd like to help. It lines up closely with the work I do.`
      : `I'm applying for the ${p.title} role. It lines up closely with the work I do.`,
    "",
    list
      ? `I work day to day with ${list}, so I can get productive quickly on your ${lead ? "project" : "team"}.`
      : `I'd bring hands-on experience and clear communication to your ${lead ? "project" : "team"}.`,
    i.notes ? i.notes.trim() : null,
    "",
    lead
      ? "As a first step, I'd suggest a short call to agree on scope and milestones. I can then send a fixed plan and timeline within a day."
      : "I'd be glad to talk through how I'd approach the first few weeks. When would suit you for a short call?",
    "",
    "Thanks for your time,",
    i.business.businessName ? `${first}, ${i.business.businessName}` : i.profile.displayName,
  ];
  return lines
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
