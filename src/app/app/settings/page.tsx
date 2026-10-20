import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileWizard } from "@/components/onboarding/ProfileWizard";
import { requireProfile } from "@/lib/auth";
import { templateSummaries } from "@/lib/template-summary";
import { DangerZone } from "@/components/app/DangerZone";
import { ActionForm } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { saveBusinessProfile } from "@/app/app/finance-actions";
import { getRepo } from "@/lib/data";

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
  const { repo } = await getRepo();
  const business = await repo.getBusinessProfile();
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
      <section aria-label="Invoice details" className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Invoice details</h2>
        <p className="mt-1 text-sm text-muted">Printed on every invoice and used when you email one to a client.</p>
        <ActionForm action={saveBusinessProfile} submitLabel="Save invoice details" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Business or trading name</span>
              <input name="businessName" maxLength={120} defaultValue={business.businessName ?? ""} placeholder={profile.displayName} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Tax ID / NTN (optional)</span>
              <input name="taxId" maxLength={60} defaultValue={business.taxId ?? ""} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Email clients reply to</span>
              <input name="contactEmail" type="email" maxLength={254} defaultValue={business.contactEmail ?? ""} placeholder={user.demo ? "" : user.email} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Phone (optional)</span>
              <input name="phone" type="tel" maxLength={40} defaultValue={business.phone ?? ""} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={labelCls}>Address</span>
              <textarea name="address" maxLength={500} rows={2} defaultValue={business.address ?? ""} className={`${inputCls} h-auto py-2`} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={labelCls}>How to pay you (bank, IBAN, Payoneer, Wise, JazzCash…)</span>
              <textarea name="paymentDetails" maxLength={1000} rows={3} defaultValue={business.paymentDetails ?? ""} className={`${inputCls} h-auto py-2`} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Default payment terms (days)</span>
              <input name="defaultDueDays" type="number" min={0} max={120} defaultValue={business.defaultDueDays} className={inputCls} />
            </label>
          </div>
        </ActionForm>
      </section>
      <section aria-label="Account and data" className="mt-6 rounded-2xl border border-line bg-surface p-6 text-sm">
        <h2 className="font-display text-lg font-semibold">Account and your data</h2>
        <p className="mt-2 text-muted">{user.demo ? "Demo mode: data lives in server memory for this browser session only." : `Signed in as ${user.email}`}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/api/account/export" className="lift flex h-11 items-center rounded-xl border border-line px-4 font-medium hover:border-accent">
            Export my data (JSON)
          </a>
          <span className="text-xs text-muted">Everything we hold about you, in one file.</span>
        </div>
        <DangerZone />
      </section>
    </>
  );
}
