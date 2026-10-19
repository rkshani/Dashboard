import type { TemplateInput } from "./types";

export const designer: TemplateInput = {
  id: "designer",
  version: 1,
  name: "Designer",
  tagline: "UI/UX, brand and graphic designers, and creative freelancers",
  vocabulary: { client: "Client", clients: "Clients", project: "Project", projects: "Projects", opportunity: "Gig", opportunities: "Gigs" },
  modules: [
    { id: "opportunities", label: "Gigs", icon: "radar", description: "Design gigs and agency roles matched to your craft." },
    { id: "projects", label: "Projects", icon: "layout", description: "Projects with briefs, feedback rounds and deadlines." },
    { id: "clients", label: "Clients", icon: "users", description: "Clients, notes and what each one has paid." },
    { id: "tasks", label: "Tasks", icon: "check", description: "Revisions and to-dos by due date." },
    { id: "calendar", label: "Calendar", icon: "calendar", description: "Reviews, calls and deadlines." },
    { id: "invoices", label: "Invoices", icon: "file", description: "Invoices and payments." },
    { id: "automations", label: "Automations", icon: "zap", description: "Rules that follow up for you." },
  ],
  widgets: [
    { type: "kpis", span: 3 },
    { type: "opportunities", span: 2, limit: 4, title: "New gigs" },
    { type: "today", span: 1 },
    { type: "projects", span: 1 },
    { type: "money", span: 1 },
    { type: "pipeline", span: 1 },
  ],
  onboarding: {
    skillsLabel: "Your skills and tools",
    skillSuggestions: ["UI design", "UX research", "Figma", "Branding", "Logo design", "Illustration", "Motion", "Webflow", "Packaging", "Social media design"],
    workTypes: [
      { id: "freelance", label: "Freelance gigs" },
      { id: "contract", label: "Contract roles" },
      { id: "full-time", label: "Full-time jobs" },
    ],
    rateLabel: "Rate per hour or per project",
  },
  opportunitySources: [
    { id: "design-boards", label: "Design job boards" },
    { id: "career-pages", label: "Agency career pages" },
  ],
  automations: [
    { id: "high-match-task", when: "A new gig scores 85 or more", then: "Add it to your pipeline", enabledByDefault: true },
    { id: "feedback-reminder", when: "A client hasn't replied to a review in 3 days", then: "Create a nudge task", enabledByDefault: true },
    { id: "invoice-overdue", when: "An invoice passes its due date", then: "Create a reminder task", enabledByDefault: true },
    { id: "morning-digest", when: "Every day at your chosen time", then: "Email a digest of your day, deadlines and new matches", enabledByDefault: true },
  ],
  defaultTheme: "dusk",
};

export const teacher: TemplateInput = {
  id: "teacher",
  version: 1,
  name: "Teacher / Tutor",
  tagline: "School and college teachers, private tutors and academies",
  vocabulary: { client: "Student", clients: "Students", project: "Class", projects: "Classes", opportunity: "Request", opportunities: "Requests" },
  modules: [
    { id: "timetable", label: "Timetable", icon: "calendar", description: "Your classes across the week." },
    { id: "students", label: "Students", icon: "users", description: "Students, guardians, notes and progress." },
    { id: "projects", label: "Classes", icon: "layout", description: "Classes with syllabus, assignments and tests." },
    { id: "tasks", label: "Tasks", icon: "check", description: "Marking, lesson plans and to-dos." },
    { id: "finance", label: "Fees", icon: "wallet", description: "Fees received, due and overdue." },
    { id: "opportunities", label: "Requests", icon: "radar", description: "Tutoring requests and teaching jobs." },
    { id: "automations", label: "Automations", icon: "zap", description: "Fee reminders and class prep." },
  ],
  widgets: [
    { type: "kpis", span: 3 },
    { type: "timetable", span: 2 },
    { type: "fees", span: 1 },
    { type: "today", span: 1 },
    { type: "opportunities", span: 2, limit: 3, title: "Tutoring requests and jobs" },
  ],
  onboarding: {
    skillsLabel: "Subjects and levels",
    skillSuggestions: ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Urdu", "Computer Science", "O Levels", "A Levels", "Matric", "FSc", "IELTS"],
    workTypes: [
      { id: "home-tuition", label: "Home tuition" },
      { id: "online-tuition", label: "Online tuition" },
      { id: "school-job", label: "School / college jobs" },
    ],
    rateLabel: "Monthly fee per student",
  },
  opportunitySources: [
    { id: "teaching-jobs", label: "Teaching job boards" },
    { id: "tutoring-requests", label: "Tutoring request feeds" },
  ],
  automations: [
    { id: "fee-reminder", when: "A student's fee is 3 days overdue", then: "Create a reminder and draft a polite message", enabledByDefault: true },
    { id: "class-prep", when: "A class starts in 1 hour", then: "Show its plan on Today", enabledByDefault: true },
    { id: "morning-digest", when: "Every day at your chosen time", then: "Email a digest of your day, deadlines and new matches", enabledByDefault: true },
  ],
  defaultTheme: "forest",
};

export const marketer: TemplateInput = {
  id: "marketer",
  version: 1,
  name: "Marketer / Creator",
  tagline: "Digital marketers, social media managers and content creators",
  vocabulary: { client: "Client", clients: "Clients", project: "Campaign", projects: "Campaigns", opportunity: "Deal", opportunities: "Deals" },
  modules: [
    { id: "content", label: "Content", icon: "calendar", description: "Your content calendar across channels." },
    { id: "projects", label: "Campaigns", icon: "layout", description: "Campaigns with goals, budget and dates." },
    { id: "clients", label: "Clients", icon: "users", description: "Brands and clients you work with." },
    { id: "tasks", label: "Tasks", icon: "check", description: "Posts to make, edits and approvals." },
    { id: "opportunities", label: "Deals", icon: "radar", description: "Brand deals and marketing roles." },
    { id: "finance", label: "Finance", icon: "wallet", description: "Income and expenses." },
    { id: "automations", label: "Automations", icon: "zap", description: "Posting reminders and follow-ups." },
  ],
  widgets: [
    { type: "kpis", span: 3 },
    { type: "content-calendar", span: 2 },
    { type: "today", span: 1 },
    { type: "opportunities", span: 2, limit: 3, title: "New deals" },
    { type: "money", span: 1 },
  ],
  onboarding: {
    skillsLabel: "Your niche and channels",
    skillSuggestions: ["Instagram", "TikTok", "YouTube", "LinkedIn", "SEO", "Google Ads", "Meta Ads", "Copywriting", "Email marketing", "Tech niche", "Food niche", "Fashion niche"],
    workTypes: [
      { id: "freelance", label: "Freelance clients" },
      { id: "brand-deals", label: "Brand deals" },
      { id: "full-time", label: "Full-time roles" },
    ],
    rateLabel: "Rate per post or per month",
  },
  opportunitySources: [
    { id: "marketing-boards", label: "Marketing job boards" },
    { id: "brand-deals", label: "Brand collaboration feeds" },
  ],
  automations: [
    { id: "post-reminder", when: "A scheduled post is 1 hour away", then: "Remind you with the caption and assets", enabledByDefault: true },
    { id: "invoice-overdue", when: "An invoice passes its due date", then: "Create a reminder task", enabledByDefault: true },
    { id: "morning-digest", when: "Every day at your chosen time", then: "Email a digest of your day, deadlines and new matches", enabledByDefault: true },
  ],
  defaultTheme: "daylight",
};
