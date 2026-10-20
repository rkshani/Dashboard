import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${site.name} during the beta.`,
  alternates: { canonical: "/terms" },
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. The beta",
    body: [
      `${site.name} is in beta. All features, including Pro, are free during the beta. Features may change, and we may reset or limit parts of the service while we improve it.`,
      "Before any paid plan starts we will tell you in advance, and nothing will be charged without your explicit agreement.",
    ],
  },
  {
    title: "2. Your account",
    body: [
      "You need a valid email or Google account to sign in. Keep access to it secure; you are responsible for activity on your account.",
      "You must be at least 18, or the age of majority where you live, to use the service.",
    ],
  },
  {
    title: "3. Your content",
    body: [
      "Your clients, projects, tasks, money records and invoices belong to you. We only use them to run the service for you.",
      "You can export everything or delete your account at any time from Settings. Deletion is permanent.",
    ],
  },
  {
    title: "4. Connected accounts",
    body: [
      "If you connect Google Calendar, we access only your calendar events, only to show and create them for you. You can disconnect at any time, which revokes our access.",
    ],
  },
  {
    title: "5. Job and lead listings",
    body: [
      "Opportunities come from public job boards and company career pages and are credited to their source. We don't verify employers or guarantee that a listing is accurate, still open, or suitable. Check every posting before you apply or share personal details.",
    ],
  },
  {
    title: "6. AI drafts",
    body: [
      "Proposal and cover-letter drafts are written by an AI model (Claude, by Anthropic) from the posting and your profile. They can contain mistakes or claims that don't fit you.",
      "Read and edit every draft before you send it. Nothing is sent for you, and you are responsible for what you send.",
    ],
  },
  {
    title: "7. Emails we send for you",
    body: [
      "When you email an invoice, it is sent to the address you entered for that client, and replies come to you. Only send invoices to people you work with.",
      "If you turn on payment reminders in Automations, we email the client of an unpaid invoice up to three times (1, 7 and 14 days after it is due) on your behalf. You are responsible for those reminders being appropriate; keep invoice statuses up to date so paid invoices aren't chased.",
      "The daily digest goes only to you and can be switched off in Automations.",
    ],
  },
  {
    title: "8. Acceptable use",
    body: [
      "Don't use the service to send spam, break the law, or try to access other people's data or disrupt the service.",
      "We may suspend accounts that do.",
    ],
  },
  {
    title: "9. No warranty and liability",
    body: [
      "The service is provided as is during the beta. Keep your own copies of anything critical, such as invoices you send.",
      "To the extent the law allows, we are not liable for indirect losses, lost income or lost data arising from use of the service.",
    ],
  },
  {
    title: "10. Changes and contact",
    body: [
      "We may update these terms; if a change matters, we'll tell you by email or in the app before it takes effect.",
      `Questions: ${site.contactEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted">Beta draft. Have these terms reviewed by a lawyer before a paid launch.</p>
      <p className="mt-6 text-muted">
        These terms cover your use of {site.name}. Read them with our <Link href="/privacy" className="text-accent underline">Privacy</Link> page.
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-semibold">{s.title}</h2>
            {s.body.map((b) => (
              <p key={b} className="mt-2 leading-relaxed text-muted">
                {b}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
