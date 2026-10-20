import type { AttendanceEntry, ContentInput, ContentPost, ContentStatus, SlotInput, TimetableSlot, BusinessProfile, Client, NewRecurring, NewRecurringInvoice, RecurringInvoice, RecurringTxn, ClientInput, Invoice, InvoiceInput, InvoiceStatus, Project, ProjectInput, ProjectStatus, Task, TaskInput, Transaction, TransactionInput } from "./types";

import type { PipelineStatus, Posting } from "@/lib/opportunities/types";
import type { AppNotification, NewNotification, PushSubscriptionRecord } from "@/lib/notifications/types";
import type { AutomationLogEntry, AutomationSettings, Integration } from "@/lib/automations/types";

export type NewInvoice = InvoiceInput & { currency: string; total: number };

/** Next invoice number after the highest number already used: INV-0001, INV-0002, … */
export function nextInvoiceNumber(existing: string[]) {
  const max = existing.reduce((m, n) => {
    const v = Number(/(\d+)\s*$/.exec(n)?.[1] ?? 0);
    return v > m ? v : m;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Storage interface. Pages and actions only talk to this, so the app runs the same
 * against Supabase (real accounts) and the in-memory demo store.
 * Every method is already scoped to the signed-in user.
 */
export interface Repo {
  listClients(): Promise<Client[]>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(id: string, input: ClientInput): Promise<void>;
  deleteClient(id: string): Promise<void>;

  listProjects(): Promise<Project[]>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, input: ProjectInput): Promise<void>;
  setProjectStatus(id: string, status: ProjectStatus): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, input: TaskInput): Promise<void>;
  setTaskDone(id: string, done: boolean): Promise<void>;
  deleteTask(id: string): Promise<void>;

  listTransactions(): Promise<Transaction[]>;
  createTransaction(input: TransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  listRecurring(): Promise<RecurringTxn[]>;
  createRecurring(input: NewRecurring): Promise<RecurringTxn>;
  setRecurringNext(id: string, nextDate: string): Promise<void>;
  deleteRecurring(id: string): Promise<void>;

  /** Empty (not an error) while migration 0013 hasn't been run, so pages keep working. */
  listRecurringInvoices(): Promise<RecurringInvoice[]>;
  createRecurringInvoice(input: NewRecurringInvoice): Promise<RecurringInvoice>;
  setRecurringInvoiceNext(id: string, nextDate: string): Promise<void>;
  deleteRecurringInvoice(id: string): Promise<void>;

  listInvoices(): Promise<Invoice[]>;
  createInvoice(input: NewInvoice): Promise<Invoice>;
  updateInvoice(id: string, input: Omit<NewInvoice, "currency">): Promise<void>;
  /** Assigns the next free invoice number itself. */
  /** Marking paid records the income once; moving back from paid removes that income entry. */
  setInvoiceStatus(id: string, status: InvoiceStatus, today: string): Promise<void>;
  deleteInvoice(id: string): Promise<void>;

  /** Recent postings from the shared pool (collected by the scheduled job, or the demo feed). */
  listPostings(): Promise<Posting[]>;
  getPosting(id: string): Promise<Posting | null>;
  listOpportunityStatuses(): Promise<Record<string, PipelineStatus>>;
  setOpportunityStatus(id: string, status: PipelineStatus): Promise<void>;

  getAutomationSettings(): Promise<AutomationSettings>;
  saveAutomationSettings(patch: Partial<AutomationSettings>): Promise<void>;
  listAutomationLog(limit?: number): Promise<AutomationLogEntry[]>;
  /** Records that a rule acted on `key`. Returns false if it already had (so rules never repeat). */
  logAutomation(ruleId: string, key: string, message: string): Promise<boolean>;

  getBusinessProfile(): Promise<BusinessProfile>;
  saveBusinessProfile(b: BusinessProfile): Promise<void>;

  /** Attendance between two dates (inclusive). */
  listAttendance(from: string, to: string): Promise<AttendanceEntry[]>;
  /** Replaces the marks for these students on `date`. */
  saveAttendance(date: string, classId: string | null, marks: { clientId: string; status: AttendanceEntry["status"] }[]): Promise<void>;

  listSlots(): Promise<TimetableSlot[]>;
  createSlot(input: SlotInput): Promise<TimetableSlot>;
  deleteSlot(id: string): Promise<void>;

  listContent(): Promise<ContentPost[]>;
  createContent(input: ContentInput): Promise<ContentPost>;
  updateContent(id: string, input: ContentInput): Promise<void>;
  setContentStatus(id: string, status: ContentStatus): Promise<void>;
  deleteContent(id: string): Promise<void>;

  /** Bulk inserts for CSV import, all-or-nothing. Return how many were saved. */
  createTransactions(inputs: TransactionInput[]): Promise<number>;
  createClients(inputs: ClientInput[]): Promise<number>;

  listProposals(): Promise<Proposal[]>;
  getProposal(postingId: string): Promise<Proposal | null>;
  saveProposal(postingId: string, body: string, source: Proposal["source"]): Promise<void>;

  listNotifications(limit?: number): Promise<AppNotification[]>;
  countUnreadNotifications(): Promise<number>;
  addNotification(n: NewNotification): Promise<void>;
  markNotificationsRead(): Promise<void>;
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
  savePushSubscription(s: PushSubscriptionRecord): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;

  getIntegration(provider: "google"): Promise<Integration | null>;
  saveIntegration(i: Omit<Integration, "connectedAt">): Promise<void>;
  deleteIntegration(provider: "google"): Promise<void>;
}

export type Proposal = { postingId: string; body: string; source: "ai" | "template" | "edited"; updatedAt: string };

export class NotFoundError extends Error {}
