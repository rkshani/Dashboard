import Link from "next/link";
import { fmtMoney } from "@/lib/money";
import { setOpportunityStatus } from "@/app/app/opportunity-actions";
import { MiniAction, StatusSelect } from "@/components/app/forms";
import type { FeedItem, PipelineStatus } from "@/lib/opportunities/types";
import type { Template } from "@/templates";

export function timeAgo(iso: string, now = Date.now()) {
  const h = Math.max(0, (now - Date.parse(iso)) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

const PIPE: { id: PipelineStatus; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "contacted", label: "Applied / contacted" },
  { id: "proposal", label: "Proposal / interview" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 80 ? "var(--good)" : score >= 60 ? "var(--accent)" : "var(--muted)";
  return (
    <span
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, var(--surface-2) 0deg)` }}
      role="img"
      aria-label={`Match score ${score} out of 100`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface font-mono text-sm font-semibold">{score}</span>
    </span>
  );
}

const btn = "h-9 cursor-pointer rounded-lg border border-line px-3 text-xs font-medium hover:border-accent";

function Card({ o, v, i }: { o: FeedItem; v: Template["vocabulary"]; i: number }) {
  const matched = new Set(o.matchedSkills.map((s) => s.toLowerCase()));
  return (
    <li className="lift anim-rise rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <div className="flex gap-4">
        <ScoreRing score={o.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium leading-snug">
              <a href={o.url} target="_blank" rel="noopener" className="hover:text-accent hover:underline">
                {o.title}
              </a>
            </h3>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold uppercase text-muted">{o.kind === "lead" ? v.opportunity : "Job"}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {[o.company, o.location || (o.remote ? "Remote" : null), timeAgo(o.postedAt)].filter(Boolean).join(" · ")}
          </p>
          {o.pay && (
            <p className={`mt-1 text-sm ${o.payFit === "below" ? "text-warn" : o.payFit === "meets" ? "text-good" : "text-muted"}`}>
              ≈ {fmtMoney(o.pay.min, o.pay.currency, { compact: true })}
              {o.pay.max !== o.pay.min ? `–${fmtMoney(o.pay.max, o.pay.currency, { compact: true })}` : ""} a year
              {o.salaryCurrency && o.salaryCurrency !== o.pay.currency ? <span className="text-muted"> (posted in {o.salaryCurrency})</span> : null}
            </p>
          )}
          {o.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">
              {o.tags.slice(0, 8).map((t) => (
                <li key={t} className={`rounded-md px-2 py-0.5 text-xs ${matched.has(t.toLowerCase()) ? "bg-accent/15 font-medium text-accent" : "bg-surface-2 text-muted"}`}>
                  {t}
                </li>
              ))}
            </ul>
          )}
          {o.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{o.description}</p>}
          {(o.reasons.length > 0 || o.cautions.length > 0) && (
            <p className="mt-2 text-xs">
              <span className="text-good">{o.reasons.join(" · ")}</span>
              {o.cautions.length > 0 && <span className="text-warn">{o.reasons.length ? " · " : ""}{o.cautions.join(" · ")}</span>}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {o.status === "new" || o.status === "dismissed" ? (
              <>
                <MiniAction action={setOpportunityStatus} fields={{ id: o.id, status: "saved" }} className={`${btn} border-accent/50 text-accent`}>
                  Save
                </MiniAction>
                <MiniAction action={setOpportunityStatus} fields={{ id: o.id, status: "contacted" }} className={btn}>
                  Applied / contacted
                </MiniAction>
                {o.status === "new" ? (
                  <MiniAction action={setOpportunityStatus} fields={{ id: o.id, status: "dismissed" }} className={`${btn} text-muted`}>
                    Not for me
                  </MiniAction>
                ) : (
                  <MiniAction action={setOpportunityStatus} fields={{ id: o.id, status: "new" }} className={`${btn} text-muted`}>
                    Restore
                  </MiniAction>
                )}
              </>
            ) : (
              <span className="text-xs text-muted">In your pipeline: {PIPE.find((p) => p.id === o.status)?.label}</span>
            )}
            <Link href={`/app/proposal/${encodeURIComponent(o.id)}`} className={`${btn} inline-flex items-center`}>
              Draft {o.kind === "lead" ? "proposal" : "cover letter"}
            </Link>
            <a href={o.attribution.url} target="_blank" rel="noopener" className="ml-auto text-xs text-muted hover:text-ink hover:underline">
              via {o.attribution.name} ↗
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

export function OpportunitiesView({
  template,
  items,
  tab,
  min,
  kind,
  remoteOnly,
  hideLowPay,
  hasRate,
  demo,
  liveConfigured,
}: {
  template: Template;
  items: FeedItem[];
  tab: "feed" | "pipeline" | "dismissed";
  min: number;
  kind: "all" | "job" | "lead";
  remoteOnly: boolean;
  hideLowPay: boolean;
  hasRate: boolean;
  demo: boolean;
  liveConfigured: boolean;
}) {
  const v = template.vocabulary;
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab, min, kind, remote: remoteOnly ? "1" : undefined, pay: hideLowPay ? "1" : undefined, ...patch };
    for (const [k, val] of Object.entries(merged)) if (val !== undefined && val !== "" && !(k === "kind" && val === "all")) p.set(k, String(val));
    return `?${p.toString()}`;
  };

  const feed = items.filter((o) => o.status === "new" && o.score >= min && (kind === "all" || o.kind === kind) && (!remoteOnly || o.remote) && (!hideLowPay || o.payFit !== "below"));
  const pipeline = items.filter((o) => PIPE.some((p) => p.id === o.status));
  const dismissed = items.filter((o) => o.status === "dismissed");
  const strong = items.filter((o) => o.status === "new" && o.score >= 80).length;

  const tabs = [
    { id: "feed", label: "New", count: items.filter((o) => o.status === "new" && o.score >= min).length },
    { id: "pipeline", label: "Pipeline", count: pipeline.length },
    { id: "dismissed", label: "Dismissed", count: dismissed.length },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{v.opportunities}</h1>
          <p className="text-sm text-muted">
            {items.length} recent postings scanned · {strong} strong {strong === 1 ? "match" : "matches"} (80+)
          </p>
        </div>
        <nav aria-label="Sections" className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {tabs.map((t) => (
            <Link key={t.id} href={qs({ tab: t.id })} aria-current={tab === t.id ? "page" : undefined} className={`flex h-9 items-center gap-2 rounded-lg px-3 ${tab === t.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}>
              {t.label} <span className="font-mono text-xs text-muted">{t.count}</span>
            </Link>
          ))}
        </nav>
      </header>

      {demo && (
        <p className="anim-rise mt-4 rounded-xl border border-warn/40 bg-surface p-3 text-sm text-muted">
          <strong className="text-warn">Demo feed.</strong> These are example postings from fictional companies, scored against your real profile.
          {" "}With Supabase connected, the scheduled collector fills this with live jobs.
        </p>
      )}
      {!demo && !liveConfigured && items.length === 0 && (
        <p className="anim-rise mt-4 rounded-xl border border-line bg-surface p-3 text-sm text-muted">No postings yet. The collector runs every 6 hours; the first run fills this feed.</p>
      )}

      {tab === "feed" && (
        <>
          <div className="anim-rise mt-5 flex flex-wrap items-center gap-2 text-sm" style={{ animationDelay: "60ms" }}>
            <span className="text-muted">Score</span>
            {[0, 40, 60, 80].map((m) => (
              <Link key={m} href={qs({ min: m })} aria-current={min === m ? "true" : undefined} className={`h-9 rounded-lg border px-3 leading-9 ${min === m ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}>
                {m === 0 ? "All" : `${m}+`}
              </Link>
            ))}
            <span className="ml-2 text-muted">Type</span>
            {(["all", "job", "lead"] as const).map((k) => (
              <Link key={k} href={qs({ kind: k })} aria-current={kind === k ? "true" : undefined} className={`h-9 rounded-lg border px-3 leading-9 capitalize ${kind === k ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}>
                {k === "all" ? "All" : k === "job" ? "Jobs" : v.opportunities}
              </Link>
            ))}
            <Link href={qs({ remote: remoteOnly ? undefined : "1" })} aria-current={remoteOnly ? "true" : undefined} className={`h-9 rounded-lg border px-3 leading-9 ${remoteOnly ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}>
              Remote only
            </Link>
            {hasRate ? (
              <Link href={qs({ pay: hideLowPay ? undefined : "1" })} aria-current={hideLowPay ? "true" : undefined} className={`h-9 rounded-lg border px-3 leading-9 ${hideLowPay ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}>
                Hide pay below my rate
              </Link>
            ) : (
              <Link href="/app/settings" className="h-9 px-1 leading-9 text-xs text-muted underline hover:text-ink">
                Add your rate to filter by pay
              </Link>
            )}
          </div>
          {feed.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">
              Nothing new at this score. Try a lower filter, or add more skills in <Link href="/app/settings" className="text-accent underline">Settings</Link>.
            </div>
          ) : (
            <ul className="mt-5 grid gap-3 lg:grid-cols-2">
              {feed.slice(0, 60).map((o, i) => (
                <Card key={o.id} o={o} v={v} i={i} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "pipeline" &&
        (pipeline.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">Save an opportunity to start your pipeline.</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {PIPE.map((col, ci) => {
              const list = pipeline.filter((o) => o.status === col.id);
              return (
                <section key={col.id} aria-label={col.label} className="anim-rise flex min-w-0 flex-col gap-3 rounded-2xl bg-surface-2/50 p-3" style={{ animationDelay: `${ci * 60}ms` }}>
                  <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                    {col.label} <span className="font-mono text-xs text-muted">{list.length}</span>
                  </h2>
                  {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">Nothing here</p>}
                  {list.map((o) => (
                    <article key={o.id} className="lift rounded-xl border border-line bg-surface p-3">
                      <a href={o.url} target="_blank" rel="noopener" className="block text-sm font-medium leading-snug hover:text-accent hover:underline">
                        {o.title}
                      </a>
                      <p className="mt-1 text-xs text-muted">
                        {o.company} · score {o.score}
                      </p>
                      {(col.id === "saved" || col.id === "contacted") && (
                        <Link href={`/app/proposal/${encodeURIComponent(o.id)}`} className="mt-2 inline-block text-xs text-accent hover:underline">
                          Draft {o.kind === "lead" ? "proposal" : "cover letter"} →
                        </Link>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted">via {o.attribution.name}</span>
                        <StatusSelect
                          action={setOpportunityStatus}
                          id={o.id}
                          value={o.status}
                          label={`Stage of ${o.title}`}
                          options={[...PIPE.map((p) => ({ value: p.id, label: p.label })), { value: "dismissed", label: "Remove" }]}
                        />
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        ))}

      {tab === "dismissed" &&
        (dismissed.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">Nothing dismissed.</div>
        ) : (
          <ul className="mt-6 grid gap-3 lg:grid-cols-2">
            {dismissed.map((o, i) => (
              <Card key={o.id} o={o} v={v} i={i} />
            ))}
          </ul>
        ))}

      <p className="mt-8 text-xs text-muted">
        Postings come from public job feeds and company career pages, each credited with a link to the original. Scores compare a posting&apos;s skills, title,
        work type, location and age with your profile.
      </p>
    </div>
  );
}
