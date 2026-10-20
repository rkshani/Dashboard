import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setOpportunityStatus } from "@/app/app/opportunity-actions";
import { generateProposal, saveProposalText } from "@/app/app/proposal-actions";
import { CopyButton } from "@/components/app/CopyButton";
import { ActionForm, MiniAction } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { getFeed, POSTING_ID } from "@/lib/opportunities/feed";
import { aiConfigured } from "@/lib/proposals/draft";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Proposal" };

export default function ProposalPage({ params }: PageProps<"/app/proposal/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-surface" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/app/proposal/[id]">["params"] }) {
  const raw = (await params).id;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  if (!POSTING_ID.test(id)) notFound();
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const { repo } = await getRepo();
  const [feed, draft] = await Promise.all([getFeed(repo, profile), repo.getProposal(id)]);
  const o = feed.find((x) => x.id === id);
  if (!o) notFound();
  const noun = o.kind === "lead" ? "proposal" : "cover letter";
  const ai = aiConfigured();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/opportunities" className="text-sm text-accent hover:underline">
        ← {template.vocabulary.opportunities}
      </Link>
      <header className="anim-rise mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Draft a {noun}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{o.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {o.company} · score {o.score}
          {o.matchedSkills.length > 0 && <> · you match {o.matchedSkills.slice(0, 4).join(", ")}</>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href={o.url} target="_blank" rel="noopener" className="text-accent underline">
            Open the posting ↗
          </a>
        </div>
      </header>

      <section aria-label="Generate" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">{draft ? "Write a new draft" : `Draft your ${noun}`}</h2>
        <p className="mt-1 text-sm text-muted">
          {ai
            ? "Claude writes a first draft from your profile and this posting. It never invents experience, and nothing is sent for you."
            : "A first draft is filled from your profile and this posting. (Set ANTHROPIC_API_KEY on the server for AI-written drafts.)"}
        </p>
        <ActionForm action={generateProposal} submitLabel={draft ? "Redraft" : "Draft it"} pendingLabel="Drafting…" className="mt-4">
          <input type="hidden" name="postingId" value={o.id} />
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Anything to mention? (optional)</span>
            <input name="notes" maxLength={500} placeholder="e.g. I built a similar POS app for a retail chain last year" className={inputCls} />
          </label>
        </ActionForm>
      </section>

      {draft && (
        <section aria-label="Your draft" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Your draft</h2>
            <span className="text-xs text-muted">{draft.source === "ai" ? "Written by Claude · review before sending" : draft.source === "template" ? "From the template" : "Edited by you"}</span>
          </div>
          <div key={draft.updatedAt}>
            <ActionForm action={saveProposalText} submitLabel="Save edits" className="mt-3">
              <input type="hidden" name="postingId" value={o.id} />
              <label className="sr-only" htmlFor="proposal-body">
                Draft
              </label>
              <textarea id="proposal-body" name="body" defaultValue={draft.body} rows={16} maxLength={5000} className={`${inputCls} h-auto py-3 leading-relaxed`} />
            </ActionForm>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <CopyButton targetId="proposal-body" />
            {o.status !== "proposal" && o.status !== "won" && (
              <MiniAction action={setOpportunityStatus} fields={{ id: o.id, status: "proposal" }} className="h-11 cursor-pointer rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
                I sent it: move to Proposal
              </MiniAction>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
