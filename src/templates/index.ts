import { templateSchema, type Template } from "./types";
import { softwareEngineer } from "./software-engineer";
import { designer, marketer, teacher } from "./others";

/** Parsed once at module load — a broken template fails the build, not a user's session. */
const registry: Record<string, Template> = Object.fromEntries(
  [softwareEngineer, designer, teacher, marketer].map((t) => {
    const parsed = templateSchema.parse(t);
    return [parsed.id, parsed];
  }),
);

export const DEFAULT_TEMPLATE_ID = "software-engineer";

export function listTemplates(): Template[] {
  return Object.values(registry);
}

export function getTemplate(id: string | null | undefined): Template {
  return (id && registry[id]) || registry[DEFAULT_TEMPLATE_ID];
}

export function isTemplateId(id: string): boolean {
  return id in registry;
}

export type { Template } from "./types";
