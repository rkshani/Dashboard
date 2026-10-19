import { listTemplates } from "@/templates";
import type { TemplateSummary } from "@/components/onboarding/ProfileWizard";

/** The slice of each template the onboarding UI needs (keeps the client bundle small). */
export function templateSummaries(): TemplateSummary[] {
  return listTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    tagline: t.tagline,
    defaultTheme: t.defaultTheme,
    skillsLabel: t.onboarding.skillsLabel,
    skillSuggestions: t.onboarding.skillSuggestions,
    workTypes: t.onboarding.workTypes,
    rateLabel: t.onboarding.rateLabel,
    modules: t.modules.map((m) => m.label),
  }));
}
