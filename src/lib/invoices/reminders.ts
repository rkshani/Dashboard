import { daysBetween } from "@/lib/dates";

/**
 * Payment reminders emailed to clients (the "invoice-reminder-email" automation, off by default).
 * At most three per invoice: 1, 7 and 14 days after the due date. Pure, so the schedule is tested.
 */
export const REMINDER_DAYS = [1, 7, 14] as const;

/**
 * Which reminder is due today: 1, 2 or 3, or 0 for none. Always the latest one reached, so if the
 * job didn't run for a while the client gets one email, never a backlog of all three at once.
 */
export function reminderStage(dueDate: string, today: string): 0 | 1 | 2 | 3 {
  const late = daysBetween(dueDate, today);
  if (late >= REMINDER_DAYS[2]) return late < 30 ? 3 : 0; // stop chasing by email after a month
  if (late >= REMINDER_DAYS[1]) return 2;
  if (late >= REMINDER_DAYS[0]) return 1;
  return 0;
}

/** The note at the top of the reminder email, firmer with each stage but always polite. */
export function reminderMessage(stage: 1 | 2 | 3, o: { clientName: string | null; number: string; amount: string; daysLate: number; from: string }) {
  const hi = o.clientName ? `Hi ${o.clientName.split(" ")[0]},` : "Hi,";
  const days = `${o.daysLate} ${o.daysLate === 1 ? "day" : "days"}`;
  const body =
    stage === 1
      ? `Just a friendly reminder that invoice ${o.number} for ${o.amount} was due ${o.daysLate === 1 ? "yesterday" : `${days} ago`}. If you've already paid, thank you, and please ignore this email.`
      : stage === 2
        ? `Invoice ${o.number} for ${o.amount} is now ${days} overdue. Could you let me know when I can expect payment? The invoice is attached again for convenience.`
        : `I'm following up once more on invoice ${o.number} for ${o.amount}, now ${days} overdue. Please arrange payment, or reply if there's a problem with the invoice so we can sort it out.`;
  return `${hi}\n\n${body}\n\nThanks,\n${o.from}`;
}

export const reminderSubject = (stage: 1 | 2 | 3, number: string, from: string) =>
  stage === 1 ? `Reminder: invoice ${number} from ${from}` : `Overdue: invoice ${number} from ${from}`;
