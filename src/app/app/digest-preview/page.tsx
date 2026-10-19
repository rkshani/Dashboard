import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { composeDigest } from "@/lib/automations/compose";
import { getRepo } from "@/lib/data";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Digest preview" };

export default function DigestPreviewPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/automations" className="text-sm text-accent hover:underline">
        ← Automations
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Today&apos;s digest</h1>
      <p className="mt-1 text-sm text-muted">Exactly what the email would contain right now.</p>
      <Suspense fallback={<div className="mt-6 h-[640px] animate-pulse rounded-2xl bg-surface" />}>
        <Preview />
      </Suspense>
    </div>
  );
}

async function Preview() {
  const { profile } = await requireProfile();
  const { repo, today, userId } = await getRepo();
  const { digest, html } = await composeDigest({ repo, profile, template: getTemplate(profile.templateId), today, ownerId: userId });
  return (
    <>
      <p className="mt-6 rounded-xl border border-line bg-surface p-3 text-sm">
        <span className="text-muted">Subject: </span>
        {digest.subject}
      </p>
      {/* Sandboxed: no scripts, no same-origin access. Content is our own escaped HTML. */}
      <iframe title="Digest email preview" srcDoc={html} sandbox="" className="mt-3 h-[720px] w-full rounded-2xl border border-line bg-white" />
    </>
  );
}
