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
});
export type TaskInput = z.output<typeof taskInput>;

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
