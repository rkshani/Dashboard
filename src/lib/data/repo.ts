import type { Client, ClientInput, Invoice, InvoiceInput, InvoiceStatus, Project, ProjectInput, ProjectStatus, Task, TaskInput, Transaction, TransactionInput } from "./types";

export type NewInvoice = InvoiceInput & { number: string; currency: string; total: number };

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
  setTaskDone(id: string, done: boolean): Promise<void>;
  deleteTask(id: string): Promise<void>;

  listTransactions(): Promise<Transaction[]>;
  createTransaction(input: TransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  listInvoices(): Promise<Invoice[]>;
  createInvoice(input: NewInvoice): Promise<Invoice>;
  updateInvoice(id: string, input: Omit<NewInvoice, "number" | "currency">): Promise<void>;
  /** Marking paid records the income once; moving back from paid removes that income entry. */
  setInvoiceStatus(id: string, status: InvoiceStatus, today: string): Promise<void>;
  deleteInvoice(id: string): Promise<void>;
}

export class NotFoundError extends Error {}
