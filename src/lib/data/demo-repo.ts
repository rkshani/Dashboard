import "server-only";
import { randomUUID } from "node:crypto";
import { NotFoundError, type Repo } from "./repo";
import type { Client, ClientInput, Project, ProjectInput, ProjectStatus, Task, TaskInput } from "./types";

/**
 * In-memory store for demo mode, one per demo session id.
 * It lives in the server process: restarting the server resets it.
 * Capped so a public demo can't be used to fill memory.
 */
type Store = { clients: Client[]; projects: Project[]; tasks: Task[]; touched: number };
const LIMIT = { sessions: 500, clients: 200, projects: 200, tasks: 1000 };

const g = globalThis as unknown as { __dashDemo?: Map<string, Store> };
const stores = (g.__dashDemo ??= new Map<string, Store>());

function addDays(base: string, days: number) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed(today: string): Store {
  const now = new Date().toISOString();
  const c1 = randomUUID(), c2 = randomUUID();
  const p1 = randomUUID(), p2 = randomUUID(), p3 = randomUUID();
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
    tasks: [
      { id: randomUUID(), projectId: p1, title: "Finish checkout screen", dueDate: today, priority: "high", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p2, title: "Send build to client for review", dueDate: addDays(today, -1), priority: "high", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p1, title: "Inventory sync with backend", dueDate: addDays(today, 3), priority: "normal", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: null, title: "Update portfolio case study", dueDate: null, priority: "low", done: false, doneAt: null, createdAt: now },
      { id: randomUUID(), projectId: p1, title: "Set up project repo", dueDate: addDays(today, -5), priority: "normal", done: true, doneAt: now, createdAt: now },
    ],
  };
}

function getStore(sessionId: string, today: string): Store {
  let s = stores.get(sessionId);
  if (!s) {
    if (stores.size >= LIMIT.sessions) {
      const oldest = [...stores.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
      if (oldest) stores.delete(oldest[0]);
    }
    s = seed(today);
    stores.set(sessionId, s);
  }
  s.touched = Date.now();
  return s;
}

function cap(n: number, max: number) {
  if (n >= max) throw new Error("Demo limit reached");
}

export class DemoRepo implements Repo {
  private s: Store;
  constructor(sessionId: string, today: string) {
    this.s = getStore(sessionId, today);
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
}
