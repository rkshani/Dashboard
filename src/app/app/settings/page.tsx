import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileWizard } from "@/components/onboarding/ProfileWizard";
import { requireProfile } from "@/lib/auth";
import { templateSummaries } from "@/lib/template-summary";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="anim-rise font-display text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Change your template, skills, work preferences and look. Your dashboard updates as soon as you save.</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <SettingsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SettingsBody({ searchParams }: { searchParams: PageProps<"/app/settings">["searchParams"] }) {
  const { user, profile } = await requireProfile();
  const sp = await searchParams;
  return (
    <>
      {sp.saved === "1" && (
        <p role="status" className="anim-rise mt-6 rounded-xl border border-good/40 bg-surface p-3 text-sm text-good">
          Saved. Your dashboard has been updated.
        </p>
      )}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <ProfileWizard templates={templateSummaries()} existing={profile} mode="settings" />
      </div>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-semibold">Account</h2>
        <p className="mt-2 text-muted">{user.demo ? "Demo mode: nothing is stored on a server." : `Signed in as ${user.email}`}</p>
      </section>
    </>
  );
}
