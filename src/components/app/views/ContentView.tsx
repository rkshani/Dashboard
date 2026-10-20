import Link from "next/link";
import { deleteContent, saveContent, setContentStatus } from "@/app/app/content-actions";
import { ActionForm, MiniAction, StatusSelect } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { Icon } from "@/components/Sections";
import { CHANNELS, CONTENT_STATUSES, type Client, type ContentPost, type ContentStatus, type Project } from "@/lib/data/types";
import { monthLabel, shiftMonth } from "@/lib/money";
import { addDaysISO } from "@/lib/recurrence";
import { weekStart } from "@/lib/teaching/fees";
import type { Template } from "@/templates";

export const contentStatusLabel: Record<ContentStatus, string> = { idea: "Idea", draft: "Draft", scheduled: "Scheduled", published: "Published" };
const statusTone: Record<ContentStatus, string> = { idea: "bg-surface-2 text-muted", draft: "bg-warn/15 text-warn", scheduled: "bg-accent/15 text-accent", published: "bg-good/15 text-good" };
const statusOptions = CONTENT_STATUSES.map((s) => ({ value: s, label: contentStatusLabel[s] }));

function ContentFields({ post, campaigns, clients, v, date }: { post?: ContentPost; campaigns: Project[]; clients: Client[]; v: Template["vocabulary"]; date: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {post && <input type="hidden" name="id" value={post.id} />}
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={labelCls}>Title *</span>
        <input name="title" required maxLength={160} defaultValue={post?.title} placeholder="e.g. Winter menu carousel" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Channel</span>
        <select name="channel" defaultValue={post?.channel ?? "Instagram"} className={inputCls}>
          {CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Status</span>
        <select name="status" defaultValue={post?.status ?? "idea"} className={inputCls}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Date</span>
        <input name="date" type="date" required defaultValue={post?.date ?? date} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Time (optional)</span>
        <input name="time" type="time" defaultValue={post?.time ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{v.project}</span>
        <select name="campaignId" defaultValue={post?.campaignId ?? ""} className={inputCls}>
          <option value="">None</option>
          {campaigns
            .filter((p) => p.status !== "done" || p.id === post?.campaignId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{v.client}</span>
        <select name="clientId" defaultValue={post?.clientId ?? ""} className={inputCls}>
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={labelCls}>Caption / notes</span>
        <textarea name="caption" maxLength={3000} rows={3} defaultValue={post?.caption ?? ""} className={`${inputCls} h-auto py-2`} />
      </label>
    </div>
  );
}

/** Marketers: a month calendar of posts across channels, plus a list of what's coming up. */
export function ContentView({ template, title, posts, campaigns, clients, today, month }: { template: Template; title: string; posts: ContentPost[]; campaigns: Project[]; clients: Client[]; today: string; month: string }) {
  const v = template.vocabulary;
  const campaign = new Map(campaigns.map((p) => [p.id, p.title]));
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
  const weeks = days[35].slice(0, 7) === month ? 6 : 5;
  const byDate = new Map<string, ContentPost[]>();
  for (const p of posts) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
  const upcoming = posts.filter((p) => p.date >= today && p.status !== "published").slice(0, 12);
  const thisMonth = posts.filter((p) => p.date.startsWith(month));
  const counts = CONTENT_STATUSES.map((s) => ({ s, n: thisMonth.filter((p) => p.status === s).length }));
  const defaultDate = month === today.slice(0, 7) ? today : first;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">{counts.map((c) => `${c.n} ${contentStatusLabel[c.s].toLowerCase()}`).join(" · ")} this month</p>
        </div>
        <nav aria-label="Month" className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <Link href={`?m=${shiftMonth(month, -1)}`} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            ‹
          </Link>
          <span className="min-w-36 px-2 text-center text-sm font-medium">{monthLabel(month)}</span>
          <Link href={`?m=${shiftMonth(month, 1)}`} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            ›
          </Link>
        </nav>
      </header>

      <section aria-label={`${monthLabel(month)} calendar`} className="anim-rise mt-6 hidden overflow-hidden rounded-2xl border border-line bg-surface md:block" style={{ animationDelay: "60ms" }}>
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.slice(0, weeks * 7).map((d) => {
            const list = byDate.get(d) ?? [];
            const out = !d.startsWith(month);
            return (
              <div key={d} className={`min-h-28 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${out ? "bg-bg/40" : ""}`}>
                <p className={`mb-1 text-right text-xs ${d === today ? "font-bold text-accent" : out ? "text-muted/60" : "text-muted"}`}>{Number(d.slice(8))}</p>
                <ul className="flex flex-col gap-1">
                  {list.slice(0, 3).map((p) => (
                    <li key={p.id} title={`${p.channel} · ${contentStatusLabel[p.status]}${p.time ? ` · ${p.time}` : ""}`} className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${statusTone[p.status]}`}>
                      {p.time ? `${p.time} ` : ""}
                      {p.title}
                    </li>
                  ))}
                  {list.length > 3 && <li className="px-1.5 text-[11px] text-muted">+{list.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section aria-label="Plan a post" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 lg:col-span-2" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-4 font-display text-lg font-semibold">Plan a post</h2>
          <ActionForm action={saveContent} submitLabel="Add to calendar" resetOnSuccess>
            <ContentFields campaigns={campaigns} clients={clients} v={v} date={defaultDate} />
          </ActionForm>
        </section>

        <section aria-label="Coming up" className="anim-rise min-w-0 rounded-2xl border border-line bg-surface p-5 lg:col-span-3" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-3 font-display text-lg font-semibold">Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Nothing planned yet. Add your first post.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">
                      {p.date === today ? "Today" : p.date.slice(5)}
                      {p.time ? ` ${p.time}` : ""}
                    </span>
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{p.channel}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                    <StatusSelect action={setContentStatus} id={p.id} value={p.status} options={statusOptions} label={`Status of ${p.title}`} />
                  </div>
                  {(p.campaignId || p.caption) && <p className="mt-1 truncate text-xs text-muted">{[p.campaignId ? campaign.get(p.campaignId) : null, p.caption].filter(Boolean).join(" · ")}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer list-none text-xs text-accent hover:underline">Edit</summary>
                    <div className="pt-3">
                      <ActionForm action={saveContent} submitLabel="Save">
                        <ContentFields post={p} campaigns={campaigns} clients={clients} v={v} date={p.date} />
                      </ActionForm>
                      <div className="mt-2 flex justify-end">
                        <MiniAction action={deleteContent} fields={{ id: p.id }} confirm={`Delete "${p.title}"?`} className="h-9 cursor-pointer rounded-lg px-3 text-xs text-warn hover:bg-surface-2">
                          <Icon name="close" className="mr-1 inline h-3.5 w-3.5" />
                          Delete
                        </MiniAction>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
