import { extractSkills } from "./skills";
import { fingerprint } from "./text";
import type { Posting } from "./types";

/**
 * Example postings for demo mode only. Companies are fictional and every card is
 * labelled "Demo feed". Real accounts use the live collectors instead.
 */
const raw: { title: string; company: string; location: string; remote: boolean; hoursAgo: number; kind: Posting["kind"]; desc: string }[] = [
  { title: "Senior Android Engineer (Kotlin, Jetpack Compose)", company: "Northwind Labs", location: "Remote (EMEA)", remote: true, hoursAgo: 3, kind: "job", desc: "Full-time. Build our consumer Android app in Kotlin and Jetpack Compose. Coroutines, Hilt, Room. CI/CD experience a plus." },
  { title: "Flutter developer for fintech MVP", company: "Copperleaf Pay", location: "Remote", remote: true, hoursAgo: 6, kind: "lead", desc: "Freelance, fixed-price project. Flutter and Dart app with Firebase auth and Stripe-style payments. 6–8 weeks." },
  { title: "Contract Kotlin Multiplatform engineer", company: "Bluefield Health", location: "Remote, Europe time zones", remote: true, hoursAgo: 20, kind: "lead", desc: "3-month contract to share business logic between Android and iOS using Kotlin Multiplatform." },
  { title: "Full-stack engineer (Next.js, TypeScript, PostgreSQL)", company: "Tallowbrook", location: "Remote", remote: true, hoursAgo: 28, kind: "job", desc: "Full-time role on a B2B SaaS. Next.js, React, TypeScript, Node.js and PostgreSQL. Some AWS." },
  { title: "React Native developer — part-time", company: "Pinecrest Studio", location: "Remote", remote: true, hoursAgo: 40, kind: "lead", desc: "Part-time contractor, ~20h/week, maintaining a React Native app with a Node.js backend." },
  { title: "Mobile Lead (Android + Flutter)", company: "Harbor & Co", location: "Islamabad, Pakistan (hybrid)", remote: false, hoursAgo: 52, kind: "job", desc: "Lead a team of 4 mobile developers. Android (Kotlin) and Flutter apps with 1M+ users. Hybrid, Islamabad." },
  { title: "Backend engineer (Python, FastAPI)", company: "Quartzline", location: "Remote (US)", remote: true, hoursAgo: 60, kind: "job", desc: "Full-time. Python, FastAPI, PostgreSQL, Docker and Kubernetes on GCP." },
  { title: "LLM / RAG engineer for document search", company: "Silverpine AI", location: "Remote", remote: true, hoursAgo: 72, kind: "lead", desc: "Freelance project. Build a retrieval-augmented generation pipeline over PDFs. Python, LLM APIs, vector search." },
  { title: "Laravel developer to fix and extend admin panel", company: "Greystone Retail", location: "Remote", remote: true, hoursAgo: 90, kind: "lead", desc: "Hourly contract. PHP, Laravel and MySQL admin panel. Bug fixes and two new modules." },
  { title: "iOS engineer (Swift, SwiftUI)", company: "Maple & Main", location: "London, UK", remote: false, hoursAgo: 110, kind: "job", desc: "Full-time, on-site in London. Swift and SwiftUI app for a retail brand." },
  { title: "DevOps engineer — Kubernetes and Terraform", company: "Ironbark Cloud", location: "Remote", remote: true, hoursAgo: 130, kind: "job", desc: "Full-time. Kubernetes, Terraform, AWS, CI/CD pipelines." },
  { title: "Product designer (Figma, design systems)", company: "Lumen Collective", location: "Remote", remote: true, hoursAgo: 8, kind: "job", desc: "Full-time product designer. UI design in Figma, maintain our design system, run user research sessions." },
  { title: "Brand identity for a coffee startup", company: "Roastline", location: "Remote", remote: true, hoursAgo: 30, kind: "lead", desc: "Freelance branding project: logo, brand identity and packaging. 4 weeks." },
  { title: "UX researcher (contract)", company: "Clearwater Bank", location: "Remote", remote: true, hoursAgo: 70, kind: "lead", desc: "6-week contract running UX research and usability tests for a mobile banking app." },
  { title: "Social media manager (Instagram, TikTok)", company: "Saffron Eats", location: "Remote", remote: true, hoursAgo: 12, kind: "lead", desc: "Monthly retainer to run Instagram and TikTok for a restaurant group. Content calendar and copywriting." },
  { title: "Performance marketer — Google Ads and Meta Ads", company: "Brightpath Courses", location: "Remote", remote: true, hoursAgo: 45, kind: "job", desc: "Full-time. Manage Google Ads and Meta Ads budgets, SEO basics, email marketing." },
  { title: "O Level Physics and Mathematics tutor", company: "Private family", location: "Lahore, Pakistan", remote: false, hoursAgo: 5, kind: "lead", desc: "Home tuition, 3 days a week, physics and mathematics for O Levels." },
  { title: "Online IELTS English teacher", company: "Bridgeway Academy", location: "Remote", remote: true, hoursAgo: 26, kind: "lead", desc: "Part-time online English and IELTS classes, evening slots." },
  { title: "Chemistry teacher (A Levels)", company: "Cedar Grove School", location: "Islamabad, Pakistan", remote: false, hoursAgo: 80, kind: "job", desc: "Full-time school job teaching A Level chemistry." },
];

export function demoPostings(now = Date.now()): Posting[] {
  return raw.map((r, i) => {
    const id = `demo-${i + 1}`;
    const url = `https://example.com/jobs/${id}`;
    return {
      id: `demo:${id}`,
      source: "demo",
      externalId: id,
      fingerprint: fingerprint(r.company, r.title),
      kind: r.kind,
      title: r.title,
      company: r.company,
      url,
      location: r.location,
      remote: r.remote,
      tags: Array.from(new Set([...extractSkills(r.title), ...extractSkills(r.desc, { prose: true })])),
      description: r.desc,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: new Date(now - r.hoursAgo * 3_600_000).toISOString(),
      attribution: { name: "Demo feed", url },
    };
  });
}
