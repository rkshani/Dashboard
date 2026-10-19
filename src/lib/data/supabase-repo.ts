import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, type NewInvoice, type Repo } from "./repo";
import type { Client, ClientInput, Invoice, InvoiceStatus, Project, ProjectInput, ProjectStatus, Task, TaskInput, Transaction, TransactionInput } from "./types";

type ClientRow = { id: string; name: string; company: string | null; email: string | null; phone: string | null; status: Client["status"]; notes: string | null; created_at: string };
type ProjectRow = { id: string; client_id: string | null; title: string; status: ProjectStatus; deadline: string | null; budget: number | string | null; description: string | null; created_at: string };
type TaskRow = { id: string; project_id: string | null; title: string; due_date: string | null; priority: Task["priority"]; done: boolean; done_at: string | null; created_at: string };

type TxRow = { id: string; kind: Transaction["kind"]; amount: number | string; currency: string; category: string; date: string; note: string | null; client_id: string | null; project_id: string | null; invoice_id: string | null; created_at: string };
type InvoiceRow = { id: string; client_id: string | null; project_id: string | null; number: string; issue_date: string; due_date: string | null; currency: string; items: Invoice["items"]; total: number | string; status: InvoiceStatus; paid_at: string | null; notes: string | null; created_at: string };

const toTx = (r: TxRow): Transaction => ({ id: r.id, kind: r.kind, amount: Number(r.amount), currency: r.currency, category: r.category, date: r.date, note: r.note, clientId: r.client_id, projectId: r.project_id, invoiceId: r.invoice_id, createdAt: r.created_at });
const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  clientId: r.client_id,
  projectId: r.project_id,
  number: r.number,
  issueDate: r.issue_date,
  dueDate: r.due_date,
  currency: r.currency,
  items: Array.isArray(r.items) ? r.items : [],
  total: Number(r.total),
  status: r.status,
  paidAt: r.paid_at,
  notes: r.notes,
  createdAt: r.created_at,
});

const toClient = (r: ClientRow): Client => ({ id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone, status: r.status, notes: r.notes, createdAt: r.created_at });
const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  clientId: r.client_id,
  title: r.title,
  status: r.status,
  deadline: r.deadline,
  budget: r.budget === null ? null : Number(r.budget),
  description: r.description,
  createdAt: r.created_at,
});
const toTask = (r: TaskRow): Task => ({ id: r.id, projectId: r.project_id, title: r.title, dueDate: r.due_date, priority: r.priority, done: r.done, doneAt: r.done_at, createdAt: r.created_at });

function check(error: { message: string; code?: string } | null) {
  if (error) {
    console.error("[db]", error.code, error.message);
    throw new Error("Database error");
  }
}

/** RLS limits every query to the signed-in user; owner_id defaults to auth.uid() on insert. */
export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  async listClients() {
    const { data, error } = await this.db.from("clients").select("id,name,company,email,phone,status,notes,created_at").order("created_at", { ascending: false }).limit(500);
    check(error);
    return (data as ClientRow[]).map(toClient);
  }
  async createClient(i: ClientInput) {
    const { data, error } = await this.db.from("clients").insert({ name: i.name, company: i.company, email: i.email, phone: i.phone, status: i.status, notes: i.notes }).select().single<ClientRow>();
    check(error);
    return toClient(data!);
  }
  async updateClient(id: string, i: ClientInput) {
    const { data, error } = await this.db.from("clients").update({ name: i.name, company: i.company, email: i.email, phone: i.phone, status: i.status, notes: i.notes }).eq("id", id).select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async deleteClient(id: string) {
    const { error } = await this.db.from("clients").delete().eq("id", id);
    check(error);
  }

  async listProjects() {
    const { data, error } = await this.db.from("projects").select("id,client_id,title,status,deadline,budget,description,created_at").order("created_at", { ascending: false }).limit(500);
    check(error);
    return (data as ProjectRow[]).map(toProject);
  }
  async createProject(i: ProjectInput) {
    const { data, error } = await this.db
      .from("projects")
      .insert({ title: i.title, client_id: i.clientId, status: i.status, deadline: i.deadline, budget: i.budget, description: i.description })
      .select()
      .single<ProjectRow>();
    check(error);
    return toProject(data!);
  }
  async updateProject(id: string, i: ProjectInput) {
    const { data, error } = await this.db
      .from("projects")
      .update({ title: i.title, client_id: i.clientId, status: i.status, deadline: i.deadline, budget: i.budget, description: i.description })
      .eq("id", id)
      .select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async setProjectStatus(id: string, status: ProjectStatus) {
    const { error } = await this.db.from("projects").update({ status }).eq("id", id);
    check(error);
  }
  async deleteProject(id: string) {
    const { error } = await this.db.from("projects").delete().eq("id", id);
    check(error);
  }

  async listTasks() {
    const { data, error } = await this.db.from("tasks").select("id,project_id,title,due_date,priority,done,done_at,created_at").order("created_at", { ascending: false }).limit(1000);
    check(error);
    return (data as TaskRow[]).map(toTask);
  }
  async createTask(i: TaskInput) {
    const { data, error } = await this.db.from("tasks").insert({ title: i.title, project_id: i.projectId, due_date: i.dueDate, priority: i.priority }).select().single<TaskRow>();
    check(error);
    return toTask(data!);
  }
  async setTaskDone(id: string, done: boolean) {
    const { error } = await this.db.from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    check(error);
  }
  async deleteTask(id: string) {
    const { error } = await this.db.from("tasks").delete().eq("id", id);
    check(error);
  }

  // ---------------- Finance ----------------

  async listTransactions() {
    const { data, error } = await this.db.from("transactions").select("*").order("date", { ascending: false }).limit(3000);
    check(error);
    return (data as TxRow[]).map(toTx);
  }
  async createTransaction(i: TransactionInput) {
    const { data, error } = await this.db
      .from("transactions")
      .insert({ kind: i.kind, amount: i.amount, currency: i.currency, category: i.category, date: i.date, note: i.note, client_id: i.clientId, project_id: i.projectId, invoice_id: i.invoiceId ?? null })
      .select()
      .single<TxRow>();
    check(error);
    return toTx(data!);
  }
  async deleteTransaction(id: string) {
    const { error } = await this.db.from("transactions").delete().eq("id", id);
    check(error);
  }

  async listInvoices() {
    const { data, error } = await this.db.from("invoices").select("*").order("issue_date", { ascending: false }).limit(1000);
    check(error);
    return (data as InvoiceRow[]).map(toInvoice);
  }
  async createInvoice(i: NewInvoice) {
    const { data, error } = await this.db
      .from("invoices")
      .insert({ client_id: i.clientId, project_id: i.projectId, number: i.number, issue_date: i.issueDate, due_date: i.dueDate, currency: i.currency, items: i.items, total: i.total, notes: i.notes })
      .select()
      .single<InvoiceRow>();
    check(error);
    return toInvoice(data!);
  }
  async updateInvoice(id: string, i: Omit<NewInvoice, "number" | "currency">) {
    const { data, error } = await this.db
      .from("invoices")
      .update({ client_id: i.clientId, project_id: i.projectId, issue_date: i.issueDate, due_date: i.dueDate, items: i.items, total: i.total, notes: i.notes })
      .eq("id", id)
      .neq("status", "paid")
      .select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async setInvoiceStatus(id: string, status: InvoiceStatus, today: string) {
    const { data: inv, error } = await this.db.from("invoices").select("*").eq("id", id).maybeSingle<InvoiceRow>();
    check(error);
    if (!inv) throw new NotFoundError();
    if (inv.status === status) return;
    const upd = await this.db.from("invoices").update({ status, paid_at: status === "paid" ? today : null }).eq("id", id);
    check(upd.error);
    if (status === "paid") {
      const existing = await this.db.from("transactions").select("id").eq("invoice_id", id).limit(1);
      check(existing.error);
      if (!existing.data?.length) {
        await this.createTransaction({
          kind: "income",
          amount: Number(inv.total),
          currency: inv.currency,
          category: "Project payment",
          date: today,
          note: `Invoice ${inv.number}`,
          clientId: inv.client_id,
          projectId: inv.project_id,
          invoiceId: id,
        });
      }
    } else if (inv.status === "paid") {
      const del = await this.db.from("transactions").delete().eq("invoice_id", id);
      check(del.error);
    }
  }
  async deleteInvoice(id: string) {
    const { error } = await this.db.from("invoices").delete().eq("id", id);
    check(error);
  }
}
