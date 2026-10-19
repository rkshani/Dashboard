import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${site.name} handles waitlist and account data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Draft for the waitlist stage. Have it reviewed before collecting account data.</p>
      <div className="mt-8 space-y-6 leading-relaxed text-muted [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink">
        <section>
          <h2>What we collect now</h2>
          <p className="mt-2">When you join the waitlist we store your email address, the field you selected and which page you signed up from. Nothing else.</p>
        </section>
        <section>
          <h2>How we use it</h2>
          <p className="mt-2">Only to invite you to {site.name} and send launch updates. We never sell or share it, and every email has an unsubscribe link.</p>
        </section>
        <section>
          <h2>Removing your data</h2>
          <p className="mt-2">Email <a href={`mailto:${site.contactEmail}`} className="text-accent">{site.contactEmail}</a> and we will delete your details.</p>
        </section>
        <section>
          <h2>When the app launches</h2>
          <p className="mt-2">Connected accounts (such as your calendar) will use the minimum permissions a feature needs, tokens will be encrypted, and you will be able to export or delete all of your data. This page will be updated with full details before launch.</p>
        </section>
      </div>
    </article>
  );
}
