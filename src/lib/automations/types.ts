export type AutomationSettings = {
  /** Rule id → on/off. Missing ids fall back to the template's default. */
  rules: Record<string, boolean>;
  digestEnabled: boolean;
  /** Local hour (0–23, in the user's time zone) to send the digest. */
  digestHour: number;
  /** YYYY-MM-DD (user's local date) of the last digest sent, so it goes out once a day. */
  lastDigestOn: string | null;
};

export const DEFAULT_SETTINGS: AutomationSettings = { rules: {}, digestEnabled: true, digestHour: 8, lastDigestOn: null };

export type AutomationLogEntry = { id: string; ruleId: string; message: string; createdAt: string };

export type Integration = { provider: "google"; refreshTokenEnc: string; accountEmail: string | null; scope: string; connectedAt: string };

/** Rules the engine can actually run today. Others in a template show as "coming soon". */
export const IMPLEMENTED_RULES = new Set(["high-match-task", "contacted-followup", "deadline-warning", "invoice-overdue", "morning-digest", "fee-reminder", "post-reminder"]);
