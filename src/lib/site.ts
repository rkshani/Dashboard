export const site = {
  name: "PilotDesk",
  tagline: "Your whole work life on one dashboard, set up for your profession.",
  description:
    "PilotDesk is a role-based all-in-one dashboard. Pick your profession and get tasks, projects, clients, meetings, money and an auto-fetched feed of matched leads and jobs in one place.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pilotdesk.app").replace(/\/$/, ""),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@pilotdesk.app",
};

export type Role = {
  slug: string;
  name: string;
  plural: string;
  status: "launching" | "planned";
  headline: string;
  summary: string;
  modules: string[];
  feed: string;
  pains: string[];
};

export const roles: Role[] = [
  {
    slug: "software-engineers",
    name: "Software Engineer",
    plural: "software engineers and developers",
    status: "launching",
    headline: "The dashboard for freelance and remote software engineers",
    summary:
      "Leads and remote jobs matched to your stack arrive on their own, next to your projects, clients, meetings and money.",
    modules: ["Matched leads and jobs", "Projects and Kanban", "Clients", "Tasks", "Calendar", "Income and expenses", "Invoices"],
    feed: "Freelance leads and remote or contract jobs matched to your skills, rate and time zone.",
    pains: [
      "Checking several job boards and freelance platforms every day",
      "Client deadlines spread across chats, email and notes",
      "Not knowing which client or project actually pays well",
    ],
  },
  {
    slug: "designers",
    name: "Designer",
    plural: "designers and creative freelancers",
    status: "planned",
    headline: "The dashboard for designers and creative freelancers",
    summary: "Gigs and agency roles matched to your craft, with projects, clients and invoices beside them.",
    modules: ["Matched gigs", "Projects", "Clients", "Invoices", "Calendar"],
    feed: "Design gigs and agency roles matched to your style and rate.",
    pains: ["Scattered client feedback", "Chasing payments", "Finding steady work"],
  },
  {
    slug: "teachers",
    name: "Teacher",
    plural: "teachers and tutors",
    status: "planned",
    headline: "The dashboard for teachers and tutors",
    summary: "Classes, students, timetable and fees in one place, with tutoring requests and teaching jobs arriving on their own.",
    modules: ["Timetable", "Students", "Assignments", "Fees", "Teaching jobs"],
    feed: "Teaching jobs and tutoring requests near you or online.",
    pains: ["Tracking fees by hand", "Juggling timetables", "Finding new students"],
  },
  {
    slug: "marketers",
    name: "Marketer",
    plural: "marketers and content creators",
    status: "planned",
    headline: "The dashboard for marketers and content creators",
    summary: "Campaigns, content calendar and clients together, with brand deals and roles matched to your niche.",
    modules: ["Content calendar", "Campaigns", "Clients", "Brand deals", "Income"],
    feed: "Brand deals and marketing roles matched to your niche.",
    pains: ["Content deadlines slipping", "Too many client channels", "Irregular income"],
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "What is PilotDesk?",
    a: "PilotDesk is an all-in-one dashboard that sets itself up for your profession. You pick your role, connect your calendar, and get tasks, projects, clients, meetings, money tracking and a feed of matched leads and jobs in one place.",
  },
  {
    q: "Who is it for?",
    a: "It launches first for freelance, remote and contract software engineers and small dev agencies. Templates for designers, teachers and marketers follow.",
  },
  {
    q: "How does PilotDesk find leads and jobs?",
    a: "Background automation collects new postings from approved public sources such as job board feeds and company career pages, removes duplicates, and scores each one against your skills, rate, time zone and preferences. Only good matches reach your feed.",
  },
  {
    q: "Does PilotDesk apply to jobs or message clients for me?",
    a: "No. It can draft a proposal or create a follow-up task, but nothing is sent on your behalf without your approval.",
  },
  {
    q: "Is my data safe?",
    a: "Account tokens are encrypted, PilotDesk asks only for the permissions a feature needs, every account's data is isolated at the database level, and you can export or delete your data at any time.",
  },
  {
    q: "How much will it cost?",
    a: "There will be a free plan and an affordable Pro plan with regional pricing. People on the waitlist get early-bird pricing.",
  },
];
