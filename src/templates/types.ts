import { z } from "zod";

/**
 * A template is pure configuration: which modules appear, what they are called,
 * which widgets make up the home screen, where opportunities come from and which
 * automations are on by default. Adding a profession = adding one config file.
 */

export const MODULE_IDS = [
  "opportunities",
  "projects",
  "clients",
  "tasks",
  "calendar",
  "finance",
  "invoices",
  "students",
  "timetable",
  "content",
  "automations",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const WIDGET_TYPES = [
  "kpis",
  "opportunities",
  "today",
  "money",
  "projects",
  "pipeline",
  "automation-log",
  "timetable",
  "fees",
  "content-calendar",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

const moduleSchema = z.object({
  id: z.enum(MODULE_IDS),
  label: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().min(1),
});

const widgetSchema = z.object({
  type: z.enum(WIDGET_TYPES),
  /** Columns spanned in the 3-column home grid (collapses on small screens). */
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  title: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const automationSchema = z.object({
  id: z.string(),
  when: z.string(),
  then: z.string(),
  enabledByDefault: z.boolean(),
});

export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  name: z.string(),
  tagline: z.string(),
  /** Words that change per profession ("Client" vs "Student"). */
  vocabulary: z.object({
    client: z.string(),
    clients: z.string(),
    project: z.string(),
    projects: z.string(),
    opportunity: z.string(),
    opportunities: z.string(),
  }),
  modules: z.array(moduleSchema).min(1),
  widgets: z.array(widgetSchema).min(1),
  onboarding: z.object({
    skillsLabel: z.string(),
    skillSuggestions: z.array(z.string()),
    workTypes: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
    rateLabel: z.string(),
    /** How to read the rate when comparing it with posted pay. */
    rateUnit: z.enum(["hour", "month", "project"]).default("hour"),
  }),
  opportunitySources: z.array(z.object({ id: z.string(), label: z.string() })),
  automations: z.array(automationSchema),
  defaultTheme: z.enum(["midnight", "daylight", "forest", "dusk"]),
});

export type Template = z.infer<typeof templateSchema>;
export type TemplateInput = z.input<typeof templateSchema>;
