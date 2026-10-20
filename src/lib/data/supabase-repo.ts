import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, type NewInvoice, type Repo } from "./repo";
import type { PipelineStatus, Posting, SourceId } from "@/lib/opportunities/types";
import { DEFAULT_SETTINGS, type AutomationSettings } from "@/lib/automations/types";
import { EMPTY_BUSINESS, type BusinessProfile } from "./types";
import type { Client, ClientInput, NewRecurring, RecurringTxn, Invoice, InvoiceStatus, Project, ProjectInput, ProjectStatus, Task, TaskInput, Transaction, TransactionInput } from "./types";

type ClientRow = { id: string; name: string; company: string | null; email: string | null; phone: string | null; status: Client["status"]; notes: string | null; created_at: string };
type ProjectRow = { id: string; client_id: string | null; title: string; status: ProjectStatus; deadline: string | null; budget: number | string | null; description: string | null; created_at: string };
type TaskRow = { id: string; project_id: string | null; title: string; due_date: string | null; priority: Task["priority"]; done: boolean; done_at: string | null; repeat: Task["repeat"] | null; created_at: string };
type RecRow = { id: string; kind: RecurringTxn["kind"]; amount: number | string; currency: string; category: string; note: string | null; client_id: string | null; project_id: string | null; cadence: RecurringTxn["cadence"]; start_date: string; next_date: string; created_at: string };
const toRec = (r: RecRow): RecurringTxn => ({ id: r.id, kind: r.kind, amount: Number(r.amount), currency: r.currency, category: r.category, note: r.note, clientId: r.client_id, projectId: r.project_id, cadence: r.cadence, startDate: r.start_date, nextDate: r.next_date, createdAt: r.created_at });

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
const toTask = (r: TaskRow): Task => ({ id: r.id, projectId: r.project_id, title: r.title, dueDate: r.due_date, priority: r.priority, done: r.done, doneAt: r.done_at, repeat: r.repeat ?? "none", createdAt: r.created_at });

const POSTING_COLS = "id,source,fingerprint,kind,title,company,url,location,remote,tags,description,salary_min,salary_max,salary_currency,posted_at,attribution_name";
type PostingRow = { id: string; source: string; fingerprint: string; kind: "job" | "lead"; title: string; company: string; url: string; location: string; remote: boolean; tags: string[]; description: string; salary_min: number | null; salary_max: number | null; salary_currency: string | null; posted_at: string; attribution_name: string };
const toPosting = (r: PostingRow): Posting => ({
  id: r.id,
  source: r.source as SourceId,
  externalId: r.id.split(":").slice(1).join(":"),
  fingerprint: r.fingerprint,
  kind: r.kind,
  title: r.title,
  company: r.company,
  url: r.url,
  location: r.location,
  remote: r.remote,
  tags: r.tags ?? [],
  description: r.description,
  salaryMin: r.salary_min === null ? null : Number(r.salary_min),
  salaryMax: r.salary_max === null ? null : Number(r.salary_max),
  salaryCurrency: r.salary_currency,
  postedAt: r.posted_at,
  attribution: { name: r.attribution_name, url: r.url },
});

function check(error: { message: string; code?: string } | null) {
  if (error) {
    console.error("[db]", error.code, error.message);
    throw new Error("Database error");
  }
}

/**
 * Every query is filtered by owner_id and every insert sets it, on top of row-level security.
 * With a user's session this is defense in depth; with the service-role key (scheduled jobs)
 * it is what keeps one user's job from touching another user's data.
 */
export class SupabaseRepo implements Repo {
  constructor(
    private db: SupabaseClient,
    private owner: string,
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(owner)) throw new Error("Invalid owner id");
  }

  async listClients() {
    const { data, error } = await this.db.from("clients").select("id,name,company,email,phone,status,notes,created_at").eq("owner_id", this.owner).order("created_at", { ascending: false }).limit(500);
    check(error);
    return (data as ClientRow[]).map(toClient);
  }
  async createClient(i: ClientInput) {
    const { data, error } = await this.db.from("clients").insert({ owner_id: this.owner, name: i.name, company: i.company, email: i.email, phone: i.phone, status: i.status, notes: i.notes }).select().single<ClientRow>();
    check(error);
    return toClient(data!);
  }
  async updateClient(id: string, i: ClientInput) {
    const { data, error } = await this.db.from("clients").update({ name: i.name, company: i.company, email: i.email, phone: i.phone, status: i.status, notes: i.notes }).eq("owner_id", this.owner).eq("id", id).select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async deleteClient(id: string) {
    const { error } = await this.db.from("clients").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  async listProjects() {
    const { data, error } = await this.db.from("projects").select("id,client_id,title,status,deadline,budget,description,created_at").eq("owner_id", this.owner).order("created_at", { ascending: false }).limit(500);
    check(error);
    return (data as ProjectRow[]).map(toProject);
  }
  async createProject(i: ProjectInput) {
    const { data, error } = await this.db
      .from("projects")
      .insert({ owner_id: this.owner, title: i.title, client_id: i.clientId, status: i.status, deadline: i.deadline, budget: i.budget, description: i.description })
      .select()
      .single<ProjectRow>();
    check(error);
    return toProject(data!);
  }
  async updateProject(id: string, i: ProjectInput) {
    const { data, error } = await this.db
      .from("projects")
      .update({ title: i.title, client_id: i.clientId, status: i.status, deadline: i.deadline, budget: i.budget, description: i.description }).eq("owner_id", this.owner)
      .eq("id", id)
      .select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async setProjectStatus(id: string, status: ProjectStatus) {
    const { error } = await this.db.from("projects").update({ status }).eq("owner_id", this.owner).eq("id", id);
    check(error);
  }
  async deleteProject(id: string) {
    const { error } = await this.db.from("projects").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  async listTasks() {
    const { data, error } = await this.db.from("tasks").select("id,project_id,title,due_date,priority,done,done_at,repeat,created_at").eq("owner_id", this.owner).order("created_at", { ascending: false }).limit(1000);
    check(error);
    return (data as TaskRow[]).map(toTask);
  }
  async createTask(i: TaskInput) {
    const { data, error } = await this.db.from("tasks").insert({ owner_id: this.owner, title: i.title, project_id: i.projectId, due_date: i.dueDate, priority: i.priority, repeat: i.repeat ?? "none" }).select().single<TaskRow>();
    check(error);
    return toTask(data!);
  }
  async updateTask(id: string, i: TaskInput) {
    const { data, error } = await this.db
      .from("tasks")
      .update({ title: i.title, project_id: i.projectId, due_date: i.dueDate, priority: i.priority, repeat: i.repeat ?? "none" })
      .eq("owner_id", this.owner)
      .eq("id", id)
      .select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async setTaskDone(id: string, done: boolean) {
    const { error } = await this.db.from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("owner_id", this.owner).eq("id", id);
    check(error);
  }
  async deleteTask(id: string) {
    const { error } = await this.db.from("tasks").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  // ---------------- Finance ----------------

  async listTransactions() {
    const { data, error } = await this.db.from("transactions").select("*").eq("owner_id", this.owner).order("date", { ascending: false }).limit(3000);
    check(error);
    return (data as TxRow[]).map(toTx);
  }
  async createTransaction(i: TransactionInput) {
    const { data, error } = await this.db
      .from("transactions")
      .insert({ owner_id: this.owner, kind: i.kind, amount: i.amount, currency: i.currency, category: i.category, date: i.date, note: i.note, client_id: i.clientId, project_id: i.projectId, invoice_id: i.invoiceId ?? null })
      .select()
      .single<TxRow>();
    check(error);
    return toTx(data!);
  }
  async deleteTransaction(id: string) {
    const { error } = await this.db.from("transactions").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  async listRecurring() {
    const { data, error } = await this.db.from("recurring_transactions").select("*").eq("owner_id", this.owner).order("next_date").limit(200);
    check(error);
    return (data as RecRow[]).map(toRec);
  }
  async createRecurring(i: NewRecurring) {
    const { data, error } = await this.db
      .from("recurring_transactions")
      .insert({ owner_id: this.owner, kind: i.kind, amount: i.amount, currency: i.currency, category: i.category, note: i.note, client_id: i.clientId, project_id: i.projectId, cadence: i.cadence, start_date: i.startDate, next_date: i.nextDate })
      .select()
      .single<RecRow>();
    check(error);
    return toRec(data!);
  }
  async setRecurringNext(id: string, nextDate: string) {
    const { error } = await this.db.from("recurring_transactions").update({ next_date: nextDate }).eq("owner_id", this.owner).eq("id", id);
    check(error);
  }
  async deleteRecurring(id: string) {
    const { error } = await this.db.from("recurring_transactions").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  async listInvoices() {
    const { data, error } = await this.db.from("invoices").select("*").eq("owner_id", this.owner).order("issue_date", { ascending: false }).limit(1000);
    check(error);
    return (data as InvoiceRow[]).map(toInvoice);
  }
  async createInvoice(i: NewInvoice) {
    const { data, error } = await this.db
      .from("invoices")
      .insert({ owner_id: this.owner, client_id: i.clientId, project_id: i.projectId, number: i.number, issue_date: i.issueDate, due_date: i.dueDate, currency: i.currency, items: i.items, total: i.total, notes: i.notes })
      .select()
      .single<InvoiceRow>();
    check(error);
    return toInvoice(data!);
  }
  async updateInvoice(id: string, i: Omit<NewInvoice, "number" | "currency">) {
    const { data, error } = await this.db
      .from("invoices")
      .update({ client_id: i.clientId, project_id: i.projectId, issue_date: i.issueDate, due_date: i.dueDate, items: i.items, total: i.total, notes: i.notes }).eq("owner_id", this.owner)
      .eq("id", id)
      .neq("status", "paid")
      .select("id");
    check(error);
    if (!data?.length) throw new NotFoundError();
  }
  async setInvoiceStatus(id: string, status: InvoiceStatus, today: string) {
    const { data: inv, error } = await this.db.from("invoices").select("*").eq("owner_id", this.owner).eq("id", id).maybeSingle<InvoiceRow>();
    check(error);
    if (!inv) throw new NotFoundError();
    if (inv.status === status) return;
    const upd = await this.db.from("invoices").update({ status, paid_at: status === "paid" ? today : null }).eq("owner_id", this.owner).eq("id", id);
    check(upd.error);
    if (status === "paid") {
      const existing = await this.db.from("transactions").select("id").eq("owner_id", this.owner).eq("invoice_id", id).limit(1);
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
      const del = await this.db.from("transactions").delete().eq("owner_id", this.owner).eq("invoice_id", id);
      check(del.error);
    }
  }
  async deleteInvoice(id: string) {
    const { error } = await this.db.from("invoices").delete().eq("owner_id", this.owner).eq("id", id);
    check(error);
  }

  // ---------------- Opportunities ----------------

  async listPostings() {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await this.db.from("opportunities").select(POSTING_COLS).gte("posted_at", since).order("posted_at", { ascending: false }).limit(1500);
    check(error);
    return (data as PostingRow[]).map(toPosting);
  }
  async getPosting(id: string) {
    const { data, error } = await this.db.from("opportunities").select(POSTING_COLS).eq("id", id).maybeSingle<PostingRow>();
    check(error);
    return data ? toPosting(data) : null;
  }
  async listOpportunityStatuses() {
    const { data, error } = await this.db.from("user_opportunities").select("opportunity_id,status").eq("owner_id", this.owner).limit(5000);
    check(error);
    return Object.fromEntries((data ?? []).map((r) => [r.opportunity_id as string, r.status as PipelineStatus]));
  }
  async setOpportunityStatus(id: string, status: PipelineStatus) {
    const { error } = await this.db.from("user_opportunities").upsert({ owner_id: this.owner, opportunity_id: id, status, updated_at: new Date().toISOString() }, { onConflict: "owner_id,opportunity_id" });
    check(error);
  }

  // ---------------- Automations ----------------

  async getAutomationSettings(): Promise<AutomationSettings> {
    const { data, error } = await this.db.from("automation_settings").select("rules,digest_enabled,digest_hour,last_digest_on").eq("owner_id", this.owner).maybeSingle();
    check(error);
    if (!data) return { ...DEFAULT_SETTINGS };
    return {
      rules: (data.rules as Record<string, boolean>) ?? {},
      digestEnabled: Boolean(data.digest_enabled),
      digestHour: Number(data.digest_hour),
      lastDigestOn: (data.last_digest_on as string | null) ?? null,
    };
  }
  async saveAutomationSettings(patch: Partial<AutomationSettings>) {
    const cur = await this.getAutomationSettings();
    const next = { ...cur, ...patch };
    const { error } = await this.db.from("automation_settings").upsert(
      { owner_id: this.owner, rules: next.rules, digest_enabled: next.digestEnabled, digest_hour: next.digestHour, last_digest_on: next.lastDigestOn, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    );
    check(error);
  }
  async listAutomationLog(limit = 30) {
    const { data, error } = await this.db.from("automation_log").select("id,rule_id,message,created_at").eq("owner_id", this.owner).order("created_at", { ascending: false }).limit(limit);
    check(error);
    return (data ?? []).map((r) => ({ id: r.id as string, ruleId: r.rule_id as string, message: r.message as string, createdAt: r.created_at as string }));
  }
  async logAutomation(ruleId: string, key: string, message: string) {
    const { error } = await this.db.from("automation_log").insert({ owner_id: this.owner, rule_id: ruleId, key: key.slice(0, 200), message: message.slice(0, 300) });
    if (error?.code === "23505") return false; // already done
    check(error);
    return true;
  }

  // ---------------- Business details ----------------

  async getBusinessProfile(): Promise<BusinessProfile> {
    const { data, error } = await this.db.from("business_profiles").select("*").eq("owner_id", this.owner).maybeSingle();
    check(error);
    if (!data) return { ...EMPTY_BUSINESS };
    return {
      businessName: data.business_name,
      address: data.address,
      taxId: data.tax_id,
      contactEmail: data.contact_email,
      phone: data.phone,
      paymentDetails: data.payment_details,
      defaultDueDays: Number(data.default_due_days ?? 14),
    };
  }
  async saveBusinessProfile(b: BusinessProfile) {
    const { error } = await this.db.from("business_profiles").upsert(
      {
        owner_id: this.owner,
        business_name: b.businessName,
        address: b.address,
        tax_id: b.taxId,
        contact_email: b.contactEmail,
        phone: b.phone,
        payment_details: b.paymentDetails,
        default_due_days: b.defaultDueDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
    check(error);
  }

  // ---------------- Integrations ----------------

  async getIntegration(provider: "google") {
    const { data, error } = await this.db.from("integrations").select("provider,refresh_token_enc,account_email,scope,connected_at").eq("owner_id", this.owner).eq("provider", provider).maybeSingle();
    check(error);
    if (!data) return null;
    return { provider, refreshTokenEnc: data.refresh_token_enc as string, accountEmail: (data.account_email as string | null) ?? null, scope: data.scope as string, connectedAt: data.connected_at as string };
  }
  async saveIntegration(i: { provider: "google"; refreshTokenEnc: string; accountEmail: string | null; scope: string }) {
    const { error } = await this.db
      .from("integrations")
      .upsert({ owner_id: this.owner, provider: i.provider, refresh_token_enc: i.refreshTokenEnc, account_email: i.accountEmail, scope: i.scope, connected_at: new Date().toISOString() }, { onConflict: "owner_id,provider" });
    check(error);
  }
  async deleteIntegration(provider: "google") {
    const { error } = await this.db.from("integrations").delete().eq("owner_id", this.owner).eq("provider", provider);
    check(error);
  }
}
