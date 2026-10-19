import type { Profile } from "@/lib/profile";
import type { Template } from "@/templates";

/**
 * Sample data shown until the real modules and collectors are connected.
 * It is shaped by the user's own template and skills so the preview feels like theirs,
 * and every widget that uses it is labelled "Sample".
 */

export type SampleOpportunity = { id: string; score: number; title: string; meta: string; kind: string };

const titlesByTemplate: Record<string, (skill: string) => string[]> = {
  "software-engineer": (s) => [`${s} developer for a fintech MVP`, `Senior ${s} engineer (remote)`, `Rebuild an app with ${s}`, `${s} contractor for a 3-month project`],
  designer: (s) => [`${s} for a SaaS dashboard`, `Brand refresh: ${s}`, `${s} for a mobile app launch`, `Agency role: ${s} designer`],
  teacher: (s) => [`${s} tutor needed, 3 days a week`, `Online ${s} classes for 2 students`, `${s} teacher at a private school`, `Weekend ${s} batch`],
  marketer: (s) => [`${s} campaign for a local brand`, `Monthly ${s} retainer`, `${s} creator collab`, `${s} specialist role`],
};

export function sampleOpportunities(template: Template, profile: Profile, limit = 4): SampleOpportunity[] {
  const skill = profile.skills[0] ?? template.onboarding.skillSuggestions[0] ?? template.name;
  const second = profile.skills[1] ?? skill;
  const titles = (titlesByTemplate[template.id] ?? titlesByTemplate["software-engineer"])(skill);
  titles[1] = titles[1].replace(skill, second);
  const where = profile.remotePref === "onsite" ? "On-site" : profile.remotePref === "hybrid" ? "Hybrid" : "Remote";
  const kinds = ["LEAD", "JOB", "LEAD", "JOB"];
  const ages = ["2h ago", "4h ago", "5h ago", "1d ago"];
  const scores = [94, 89, 83, 78];
  return titles.slice(0, limit).map((title, i) => ({
    id: `s${i}`,
    score: scores[i],
    title,
    meta: `${kinds[i] === "LEAD" ? template.vocabulary.opportunity : "Job"} · ${where} · ${ages[i]}`,
    kind: kinds[i],
  }));
}

export function sampleToday(template: Template) {
  const v = template.vocabulary;
  return [
    { time: "09:30", title: template.id === "teacher" ? "Grade 9 Physics" : "Team standup", sub: "Calendar · 30 min", tone: "bg-accent" },
    { time: "11:00", title: `${v.client} call`, sub: `Linked to a ${v.project.toLowerCase()}`, tone: "bg-warn" },
    { time: "14:00", title: template.id === "teacher" ? "Mark test papers" : `Deliver ${v.project.toLowerCase()} update`, sub: "Task · high priority", tone: "bg-good" },
    { time: "17:30", title: `Follow up on new ${v.opportunity.toLowerCase()}`, sub: "Created by automation", tone: "bg-accent" },
  ];
}

export const sampleMoney = [
  { m: "May", inc: 55, exp: 38 },
  { m: "Jun", inc: 62, exp: 41 },
  { m: "Jul", inc: 48, exp: 44 },
  { m: "Aug", inc: 74, exp: 40 },
  { m: "Sep", inc: 68, exp: 47 },
  { m: "Oct", inc: 86, exp: 43 },
];
