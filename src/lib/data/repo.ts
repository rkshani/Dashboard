import type { Client, ClientInput, Project, ProjectInput, ProjectStatus, Task, TaskInput } from "./types";

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
}

export class NotFoundError extends Error {}
