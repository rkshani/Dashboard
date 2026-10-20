"use server";

import { z } from "zod";
import { getRepo } from "@/lib/data";
import { fmtMoney } from "@/lib/money";
import { search, type SearchDoc, type SearchHit } from "@/lib/search";
import { rateLimit } from "@/lib/rate-limit";

const q = z.string().max(100);

/** Searches everything the signed-in user owns. Called by the command palette as they type. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const parsed = q.safeParse(query);
  if (!parsed.success || !parsed.data.trim()) return [];
  const { repo, userId } = await getRepo();
  if (!(await rateLimit(`search:${userId}`, 120, 60_000))) return [];
  const [clients, projects, tasks, invoices, postings, statuses, content] = await Promise.all([
    repo.listClients(),
    repo.listProjects(),
    repo.listTasks(),
    repo.listInvoices(),
    repo.listPostings(),
    repo.listOpportunityStatuses(),
    repo.listContent(),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const projectTitle = new Map(projects.map((p) => [p.id, p.title]));
  const docs: SearchDoc[] = [
    ...clients.map((c) => ({ kind: "client" as const, id: c.id, title: c.name, subtitle: c.company ?? c.email ?? undefined, extra: `${c.email ?? ""} ${c.phone ?? ""} ${c.notes ?? ""}`, href: `/app/client/${c.id}` })),
    ...projects.map((p) => ({ kind: "project" as const, id: p.id, title: p.title, subtitle: p.clientId ? clientName.get(p.clientId) : undefined, extra: p.description ?? "", href: `/app/project/${p.id}`, done: p.status === "done" })),
    ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, subtitle: t.projectId ? projectTitle.get(t.projectId) : t.dueDate ?? undefined, href: t.projectId ? `/app/project/${t.projectId}` : "/app/tasks", done: t.done })),
    ...invoices.map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      title: `${i.number} · ${fmtMoney(i.total, i.currency)}`,
      subtitle: [i.clientId ? clientName.get(i.clientId) : null, i.status].filter(Boolean).join(" · "),
      extra: `${i.items.map((x) => x.description).join(" ")} ${i.notes ?? ""}`,
      href: `/app/invoice/${i.id}`,
    })),
    ...content.map((p) => ({ kind: "content" as const, id: p.id, title: p.title, subtitle: `${p.channel} · ${p.date}`, extra: p.caption ?? "", href: `/app/content?m=${p.date.slice(0, 7)}`, done: p.status === "published" })),
    // Only opportunities the user has acted on; the open feed is browsed on its own page.
    ...postings
      .filter((p) => statuses[p.id] && statuses[p.id] !== "dismissed")
      .map((p) => ({ kind: "opportunity" as const, id: p.id, title: p.title, subtitle: [p.company, statuses[p.id]].filter(Boolean).join(" · "), extra: p.tags.join(" "), href: "/app/opportunities?tab=pipeline" })),
  ];
  return search(docs, parsed.data, 20);
}
