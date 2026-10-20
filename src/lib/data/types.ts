import { MONEY_CADENCES, TASK_REPEATS, type MoneyCadence, type TaskRepeat } from "@/lib/recurrence";
import { z } from "zod";

export const CLIENT_STATUSES = ["lead", "active", "past"] as const;
export const PROJECT_STATUSES = ["planning", "active", "review", "done"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  notes: string | null;
  /** Teachers: monthly fee, the day of the month it's due, and the student's class. */
  monthlyFee: number | null;
  feeDueDay: number | null;
  classId: string | null;
  createdAt: string;
};

export type Project = {
  id: string;
  clientId: string | null;
  title: string;
  status: ProjectStatus;
  deadline: string | null; // YYYY-MM-DD
  budget: number | null;
  description: string | null;
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string | null;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  priority: Priority;
  done: boolean;
  doneAt: string | null;
  repeat: TaskRepeat;
  createdAt: string;
};

// ---------- Input schemas (everything from a form is parsed here, on the server) ----------

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date.");

const optUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Invalid reference.");

export const idSchema = z.string().regex(/^[0-9a-f-]{36}$/i, "Invalid id.");

export const clientInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  company: optText(120),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email."),
  phone: optText(40),
  status: z.enum(CLIENT_STATUSES).default("active"),
  notes: optText(4000),
  monthlyFee: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Fee must be a positive number."),
  feeDueDay: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 28), "Pick a due day from 1 to 28."),
  classId: optUuid,
});
export type ClientInput = z.output<typeof clientInput>;

export const projectInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  clientId: optUuid,
  status: z.enum(PROJECT_STATUSES).default("planning"),
  deadline: optDate,
  budget: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e12), "Budget must be a positive number."),
  description: optText(4000),
});
export type ProjectInput = z.output<typeof projectInput>;

export const taskInput = z.object({
  title: z.string().trim().min(1, "Write the task.").max(200),
  projectId: optUuid,
  dueDate: optDate,
  priority: z.enum(PRIORITIES).default("normal"),
  repeat: z.enum(TASK_REPEATS).default("none"),
});
export type TaskInput = Omit<z.output<typeof taskInput>, "repeat"> & { repeat?: TaskRepeat };

export type FormState = { status: "idle" | "error" | "success"; message: string; at?: number };

// ---------------- Finance ----------------

export const INCOME_CATEGORIES = ["Project payment", "Retainer", "Salary", "Fees", "Other income"] as const;
export const EXPENSE_CATEGORIES = ["Software", "Hardware", "Internet & phone", "Rent", "Transport", "Food", "Marketing", "Taxes", "Other"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type Transaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  date: string; // YYYY-MM-DD
  note: string | null;
  clientId: string | null;
  projectId: string | null;
  invoiceId: string | null;
  createdAt: string;
};

export type InvoiceItem = { description: string; quantity: number; rate: number };

export type Invoice = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  number: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  items: InvoiceItem[];
  total: number;
  status: InvoiceStatus;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

const money = z.coerce.number().refine((n) => Number.isFinite(n) && n > 0 && n < 1e12, "Enter an amount above 0.").transform((n) => Math.round(n * 100) / 100);

export const transactionInput = z.object({
  kind: z.enum(["income", "expense"]),
  amount: money,
  category: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  note: optText(300),
  clientId: optUuid,
  projectId: optUuid,
});
export type TransactionInput = z.output<typeof transactionInput> & { currency: string; invoiceId?: string | null };

/** A rule that adds the same income or expense on a schedule (rent, salary, subscriptions). */
export type RecurringTxn = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  note: string | null;
  clientId: string | null;
  projectId: string | null;
  cadence: MoneyCadence;
  startDate: string;
  nextDate: string;
  createdAt: string;
};
export type NewRecurring = Omit<RecurringTxn, "id" | "createdAt">;
export const moneyRepeatInput = z.enum(["none", ...MONEY_CADENCES]).default("none");

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description.").max(200),
  quantity: z.coerce.number().refine((n) => Number.isFinite(n) && n > 0 && n <= 100000, "Quantity must be above 0."),
  rate: z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0 && n < 1e10, "Rate can't be negative."),
});

export const invoiceInput = z.object({
  clientId: optUuid,
  projectId: optUuid,
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an issue date."),
  dueDate: optDate,
  notes: optText(2000),
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid line items." });
        return z.NEVER;
      }
    })
    .pipe(z.array(invoiceItemSchema).min(1, "Add at least one line.").max(50)),
});
export type InvoiceInput = z.output<typeof invoiceInput>;

export function invoiceTotal(items: InvoiceItem[]) {
  return Math.round(items.reduce((s, i) => s + i.quantity * i.rate, 0) * 100) / 100;
}

// ---------------- Business details (shown on invoices) ----------------

export type BusinessProfile = {
  businessName: string | null;
  address: string | null;
  taxId: string | null;
  contactEmail: string | null;
  phone: string | null;
  paymentDetails: string | null;
  defaultDueDays: number;
};

export const EMPTY_BUSINESS: BusinessProfile = { businessName: null, address: null, taxId: null, contactEmail: null, phone: null, paymentDetails: null, defaultDueDays: 14 };

export const businessInput = z.object({
  businessName: optText(120),
  address: optText(500),
  taxId: optText(60),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email."),
  phone: optText(40),
  paymentDetails: optText(1000),
  defaultDueDays: z.coerce.number().int().min(0).max(120).default(14),
});

// ---------------- Teaching ----------------

export const ATTENDANCE = ["present", "late", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE)[number];
export type AttendanceEntry = { clientId: string; date: string; status: AttendanceStatus; classId: string | null };

/** A weekly class slot. weekday: 1 = Monday … 7 = Sunday. Times are local "HH:MM". */
export type TimetableSlot = { id: string; classId: string; weekday: number; start: string; end: string; location: string | null };
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 16:30.");
export const slotInput = z
  .object({ classId: z.string().regex(/^[0-9a-f-]{36}$/i, "Pick a class."), weekday: z.coerce.number().int().min(1).max(7), start: hhmm, end: hhmm, location: optText(120) })
  .refine((v) => v.end > v.start, { message: "End time must be after the start.", path: ["end"] });
export type SlotInput = z.output<typeof slotInput>;

// ---------------- Content calendar ----------------

export const CONTENT_STATUSES = ["idea", "draft", "scheduled", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const CHANNELS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "X", "Blog", "Newsletter", "Other"] as const;
export type ContentPost = {
  id: string;
  title: string;
  channel: string;
  date: string;
  time: string | null;
  status: ContentStatus;
  caption: string | null;
  campaignId: string | null;
  clientId: string | null;
  createdAt: string;
};
export const contentInput = z.object({
  title: z.string().trim().min(1, "Give the post a title.").max(160),
  channel: z.enum(CHANNELS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use a time like 18:00."),
  status: z.enum(CONTENT_STATUSES).default("idea"),
  caption: optText(3000),
  campaignId: optUuid,
  clientId: optUuid,
});
export type ContentInput = z.output<typeof contentInput>;
