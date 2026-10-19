import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, type Repo } from "./repo";
import type { Client, ClientInput, Project, ProjectInput, ProjectStatus, Task, TaskInput } from "./types";

type ClientRow = { id: string; name: string; company: string | null; email: string | null; phone: string | null; status: Client["status"]; notes: string | null; created_at: string };
type ProjectRow = { id: string; client_id: string | null; title: string; status: ProjectStatus; deadline: string | null; budget: number | string | null; description: string | null; created_at: string };
type TaskRow = { id: string; project_id: string | null; title: string; due_date: string | null; priority: Task["priority"]; done: boolean; done_at: string | null; created_at: string };

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
}
