import "server-only";
import { randomUUID } from "node:crypto";
import { NotFoundError, type NewInvoice, type Repo } from "./repo";
import type { Client, ClientInput, Invoice, InvoiceStatus, Project, ProjectInput, ProjectStatus, Task, TaskInput, Transaction, TransactionInput } from "./types";

/**
 * In-memory store for demo mode, one per demo session id.
 * It lives in the server process: restarting the server resets it.
 * Capped so a public demo can't be used to fill memory.
 */
type Store = { clients: Client[]; projects: Project[]; tasks: Task[]; transactions: Transaction[]; invoices: Invoice[]; touched: number };
const LIMIT = { sessions: 500, clients: 200, projects: 200, tasks: 1000, transactions: 2000, invoices: 300 };

const g = globalThis as unknown as { __dashDemo?: Map<string, Store> };
const stores = (g.__dashDemo ??= new Map<string, Store>());

function addDays(base: string, days: number) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed(today: string, currency: string): Store {
  const now = new Date().toISOString();
  const c1 = randomUUID(), c2 = randomUUID();
  const p1 = randomUUID(), p2 = randomUUID(), p3 = randomUUID();
  const inv1 = randomUUID();
  return {
    touched: Date.now(),
    clients: [
      { id: c1, name: "Ayesha Khan", company: "Northwind Retail", email: "ayesha@example.com", phone: null, status: "active", notes: "Prefers WhatsApp updates on Fridays.", createdAt: now },
      { id: c2, name: "Omar Siddiqui", company: "Bright Clinic", email: "omar@example.com", phone: null, status: "active", notes: null, createdAt: now },
      { id: randomUUID(), name: "Sara Ahmed", company: "Startup lead", email: null, phone: null, status: "lead", notes: "Asked for a quote last week.", createdAt: now },
    ],
    projects: [
      { id: p1, clientId: c1, title: "Retail POS app", status: "active", deadline: addDays(today, 12), budget: 2400, description: "Point of sale and inventory app.", createdAt: now },
      { id: p2, clientId: c2, title: "Clinic booking system", status: "review", deadline: addDays(today, 4), budget: 1800, description: null, createdAt: now },
      { id: p3, clientId: null, title: "Portfolio redesign", status: "planning", deadline: null, budget: null, description: null, createdAt: now },
    ],
    invoices: [
      { id: inv1, clientId: c2, projectId: p2, number: "INV-0001", issueDate: addDays(today, -40), dueDate: addDays(today, -26), currency, items: [{ description: "Booking system: phase 1", quantity: 1, rate: 900 }], total: 900, status: "paid", paidAt: addDays(today, -28), notes: null, createdAt: now },
      { id: randomUUID(), clientId: c1, projectId: p1, number: "INV-0002", issueDate: addDays(today, -10), dueDate: addDays(today, -3), currency, items: [{ description: "POS app: design and setup", quantity: 1, rate: 600 }, { description: "Development hours", quantity: 10, rate: 25 }], total: 850, status: "sent", paidAt: null, notes: null, createdAt: now },
    ],
    transactions: [
      ...[5, 4, 3, 2, 1].flatMap((m) => [
        { id: randomUUID(), kind: "income" as const, amount: 700 + m * 90, currency, category: "Project payment", date: addDays(today, -30 * m), note: null, clientId: null, projectId: null, invoiceId: null, createdAt: now },
        { id: randomUUID(), kind: "expense" as const, amount: 220 + m * 25, currency, category: m % 2 ? "Software" : "Internet & phone", date: addDays(today, -30 * m + 2), note: null, clientId: null, projectId: null, invoiceId: null, createdAt: now },
      ]),
      { id: randomUUID(), kind: "income", amount: 900, currency, category: "Project payment", date: addDays(today, -28), note: "Invoice INV-0001", clientId: c2, projectId: p2, invoiceId: inv1, createdAt: now },
      { id: randomUUID(), kind: "income", amount: 450, currency, category: "Retainer", date: addDays(today, -2), note: "Monthly maintenance", clientId: c1, projectId: null, invoiceId: null, createdAt: now },
      { id: randomUUID(), kind: "expense", amount: 20, currency, category: "Software", date: addDays(today, -1), note: "AI subscription", clientId: null, projectId: null, invoiceId: null, createdAt: now },
    ],
    tasks: [
      { id: randomUUID(), projectId: p1, title: "Finish checkout screen", dueDate: today, priority: "high", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p2, title: "Send build to client for review", dueDate: addDays(today, -1), priority: "high", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p1, title: "Inventory sync with backend", dueDate: addDays(today, 3), priority: "normal", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: null, title: "Update portfolio case study", dueDate: null, priority: "low", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p1, title: "Set up project repo", dueDate: addDays(today, -5), priority: "normal", done: true, doneAt: now, createdAt: now },
    ],
  };
}

function getStore(sessionId: string, today: string, currency: string): Store {
  let s = stores.get(sessionId);
  if (!s) {
    if (stores.size >= LIMIT.sessions) {
      const oldest = [...stores.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
      if (oldest) stores.delete(oldest[0]);
    }
    s = seed(today, currency);
    stores.set(sessionId, s);
  }
  s.touched = Date.now();
  s.transactions ??= [];
  s.invoices ??= [];
  return s;
}

function cap(n: number, max: number) {
  if (n >= max) throw new Error("Demo limit reached");
}

export class DemoRepo implements Repo {
  private s: Store;
  constructor(sessionId: string, today: string, currency: string) {
    this.s = getStore(sessionId, today, currency);
  }

  async listClients() {
    return [...this.s.clients];
  }
  async createClient(i: ClientInput) {
    cap(this.s.clients.length, LIMIT.clients);
    const c: Client = { id: randomUUID(), ...i, createdAt: new Date().toISOString() };
    this.s.clients.unshift(c);
    return c;
  }
  async updateClient(id: string, i: ClientInput) {
    const c = this.s.clients.find((x) => x.id === id);
    if (!c) throw new NotFoundError();
    Object.assign(c, i);
  }
  async deleteClient(id: string) {
    this.s.clients = this.s.clients.filter((x) => x.id !== id);
    for (const p of this.s.projects) if (p.clientId === id) p.clientId = null;
  }

  async listProjects() {
    return [...this.s.projects];
  }
  async createProject(i: ProjectInput) {
    cap(this.s.projects.length, LIMIT.projects);
    if (i.clientId && !this.s.clients.some((c) => c.id === i.clientId)) throw new NotFoundError();
    const p: Project = { id: randomUUID(), ...i, createdAt: new Date().toISOString() };
    this.s.projects.unshift(p);
    return p;
  }
  async updateProject(id: string, i: ProjectInput) {
    const p = this.s.projects.find((x) => x.id === id);
    if (!p) throw new NotFoundError();
    if (i.clientId && !this.s.clients.some((c) => c.id === i.clientId)) throw new NotFoundError();
    Object.assign(p, i);
  }
  async setProjectStatus(id: string, status: ProjectStatus) {
    const p = this.s.projects.find((x) => x.id === id);
    if (!p) throw new NotFoundError();
    p.status = status;
  }
  async deleteProject(id: string) {
    this.s.projects = this.s.projects.filter((x) => x.id !== id);
    for (const t of this.s.tasks) if (t.projectId === id) t.projectId = null;
  }

  async listTasks() {
    return [...this.s.tasks];
  }
  async createTask(i: TaskInput) {
    cap(this.s.tasks.length, LIMIT.tasks);
    if (i.projectId && !this.s.projects.some((p) => p.id === i.projectId)) throw new NotFoundError();
    const t: Task = { id: randomUUID(), ...i, done: false, doneAt: null, createdAt: new Date().toISOString() };
    this.s.tasks.unshift(t);
    return t;
  }
  async setTaskDone(id: string, done: boolean) {
    const t = this.s.tasks.find((x) => x.id === id);
    if (!t) throw new NotFoundError();
    t.done = done;
    t.doneAt = done ? new Date().toISOString() : null;
  }
  async deleteTask(id: string) {
    this.s.tasks = this.s.tasks.filter((x) => x.id !== id);
  }

  // ---------------- Finance ----------------

  async listTransactions() {
    return [...this.s.transactions].sort((a, b) => b.date.localeCompare(a.date));
  }
  async createTransaction(i: TransactionInput) {
    cap(this.s.transactions.length, LIMIT.transactions);
    const t: Transaction = { id: randomUUID(), kind: i.kind, amount: i.amount, currency: i.currency, category: i.category, date: i.date, note: i.note, clientId: i.clientId, projectId: i.projectId, invoiceId: i.invoiceId ?? null, createdAt: new Date().toISOString() };
    this.s.transactions.unshift(t);
    return t;
  }
  async deleteTransaction(id: string) {
    this.s.transactions = this.s.transactions.filter((x) => x.id !== id);
  }

  async listInvoices() {
    return [...this.s.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }
  async createInvoice(i: NewInvoice) {
    cap(this.s.invoices.length, LIMIT.invoices);
    if (this.s.invoices.some((x) => x.number === i.number)) throw new Error("Duplicate number");
    const inv: Invoice = { id: randomUUID(), clientId: i.clientId, projectId: i.projectId, number: i.number, issueDate: i.issueDate, dueDate: i.dueDate, currency: i.currency, items: i.items, total: i.total, status: "draft", paidAt: null, notes: i.notes, createdAt: new Date().toISOString() };
    this.s.invoices.unshift(inv);
    return inv;
  }
  async updateInvoice(id: string, i: Omit<NewInvoice, "number" | "currency">) {
    const inv = this.s.invoices.find((x) => x.id === id);
    if (!inv || inv.status === "paid") throw new NotFoundError();
    Object.assign(inv, { clientId: i.clientId, projectId: i.projectId, issueDate: i.issueDate, dueDate: i.dueDate, items: i.items, total: i.total, notes: i.notes });
  }
  async setInvoiceStatus(id: string, status: InvoiceStatus, today: string) {
    const inv = this.s.invoices.find((x) => x.id === id);
    if (!inv) throw new NotFoundError();
    if (inv.status === status) return;
    const wasPaid = inv.status === "paid";
    inv.status = status;
    inv.paidAt = status === "paid" ? today : null;
    if (status === "paid" && !this.s.transactions.some((t) => t.invoiceId === id)) {
      await this.createTransaction({ kind: "income", amount: inv.total, currency: inv.currency, category: "Project payment", date: today, note: `Invoice ${inv.number}`, clientId: inv.clientId, projectId: inv.projectId, invoiceId: id });
    } else if (wasPaid && status !== "paid") {
      this.s.transactions = this.s.transactions.filter((t) => t.invoiceId !== id);
    }
  }
  async deleteInvoice(id: string) {
    this.s.invoices = this.s.invoices.filter((x) => x.id !== id);
    for (const t of this.s.transactions) if (t.invoiceId === id) t.invoiceId = null;
  }
}
