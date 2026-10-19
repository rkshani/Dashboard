import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/SiteChrome";
import { ProfileWizard } from "@/components/onboarding/ProfileWizard";
import { getProfile, requireUser } from "@/lib/auth";
import { templateSummaries } from "@/lib/template-summary";

export const metadata: Metadata = {
  title: "Set up your dashboard",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-6">
      <Logo />
      <h1 className="anim-rise mt-10 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Let&apos;s set up your dashboard</h1>
      <p className="anim-rise mt-2 text-muted" style={{ animationDelay: "0.05s" }}>Four quick steps. It takes about a minute.</p>
      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-2" />}>
          <Wizard />
        </Suspense>
      </div>
    </main>
  );
}

async function Wizard() {
  await requireUser();
  const existing = await getProfile();
  return <ProfileWizard templates={templateSummaries()} existing={existing} />;
}
