import Link from "next/link";
import { DashboardPreview } from "@/components/DashboardPreview";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/Reveal";
import { Card, Icon, SectionHeading } from "@/components/Sections";
import { THEMES } from "@/lib/themes";
import { WaitlistForm } from "@/components/WaitlistForm";
import { faqs, roles, site } from "@/lib/site";

const features = [
  { icon: "radar", title: "Leads and jobs come to you", body: "Automation checks approved sources around the clock and scores every posting against your skills, rate and time zone. Only real matches reach your feed." },
  { icon: "layout", title: "Set up for your profession", body: "Pick your field and the dashboard arrives ready: the right modules, fields, widgets and automations. No blank page, no hours of setup." },
  { icon: "users", title: "Clients and projects", body: "Every client with their projects, deadlines, notes and what they have paid you, linked to the tasks that move the work forward." },
  { icon: "calendar", title: "Your day at a glance", body: "Meetings from your calendar, tasks due today and overdue items in one Today view, with a week-ahead plan beside it." },
  { icon: "wallet", title: "Money without spreadsheets", body: "Track income, expenses and unpaid invoices by client and project, and see each month's real picture." },
  { icon: "zap", title: "Automations that follow up", body: "A strong lead becomes a task. A quiet client gets a reminder. An overdue invoice gets flagged. You approve anything that leaves the app." },
];

const steps = [
  { n: "01", title: "Pick your field", body: "Choose a template, add your skills, rate and the kind of work you want." },
  { n: "02", title: "Connect your calendar", body: "Sign in with Google. Only the access a feature needs is ever requested." },
  { n: "03", title: "Let automation work", body: "Postings are collected, de-duplicated, scored and delivered in a morning digest." },
  { n: "04", title: "Act in one place", body: "Save, draft a proposal, plan the work, track the client and get paid." },
];

const security = [
  "Account tokens encrypted at rest",
  "Minimal permissions, asked one feature at a time",
  "Each account's data isolated at the database level",
  "Nothing sent on your behalf without your approval",
  "Export or delete your data any time",
];

export default function Home() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: site.description,
    url: site.url,
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <JsonLd data={[softwareApp, faqLd]} />

      {/* Hero */}
      <section className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pt-24">
          <div>
            <p className="anim-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="anim-pulse h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
              Launching first for software engineers
            </p>
            <h1 id="hero-title" className="anim-rise mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl" style={{ animationDelay: "0.05s" }}>
              Your whole work life on one dashboard, <span className="text-accent">set up for your profession.</span>
            </h1>
            <p className="anim-rise mt-5 max-w-xl text-lg text-muted" style={{ animationDelay: "0.1s" }}>
              Tasks, projects, clients, meetings and money in one place, plus leads and jobs that arrive on their own, matched to your skills.
            </p>
            <div id="waitlist" className="anim-rise mt-8 max-w-xl scroll-mt-24" style={{ animationDelay: "0.15s" }}>
              <WaitlistForm source="home-hero" />
            </div>
          </div>
          <div className="anim-float">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" aria-labelledby="features-title">
        <SectionHeading id="features-title" eyebrow="Features" title="Stop running your work from ten tabs" intro={`Free tools already handle email and to-do lists. ${site.name} adds what they don't: zero setup and opportunities that find you.`} />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <Card className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-accent">
                  <Icon name={f.icon} />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-line bg-surface/40 scroll-mt-20" aria-labelledby="how-title">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading id="how-title" eyebrow="How it works" title="Four steps, then it runs itself" />
          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <li className="h-full list-none rounded-2xl border border-line bg-bg p-6">
                  <span className="font-mono text-sm text-accent">{s.n}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" aria-labelledby="templates-title">
        <SectionHeading id="templates-title" eyebrow="Templates" title="One product, a dashboard for every field" intro="Each profession gets its own modules, vocabulary and opportunity sources. Software engineers come first." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {roles.map((r, i) => (
            <Reveal key={r.slug} delay={i * 60}>
              <Link href={`/for/${r.slug}`} className="lift block h-full rounded-2xl border border-line bg-surface p-6 hover:border-accent">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold">{r.name}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "launching" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>
                    {r.status === "launching" ? "Launching first" : "Coming next"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{r.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.modules.slice(0, 5).map((m) => (
                    <span key={m} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs">{m}</span>
                  ))}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="themes-title">
        <Reveal className="rounded-3xl border border-line bg-surface p-8 sm:p-10">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 id="themes-title" className="font-display text-2xl font-semibold sm:text-3xl">Four themes. Try them now.</h2>
              <p className="mt-3 text-muted">Use the switcher at the top of this page. Midnight, Daylight, Forest and Dusk all share one layout, and motion turns off if your device asks for less of it.</p>
            </div>
            <div className="grid grid-cols-4 gap-3" aria-hidden="true">
              {THEMES.map((t) => (
                <div key={t.id} className="text-center">
                  <div className="lift mx-auto h-16 w-16 rounded-2xl border border-line" style={{ background: t.swatch }} />
                  <div className="mt-2 text-xs text-muted">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="security-title">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <Reveal>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-good">
              <Icon name="shield" />
            </span>
            <h2 id="security-title" className="mt-4 font-display text-3xl font-semibold tracking-tight">Built to be trusted with your work</h2>
            <p className="mt-3 text-muted">{site.name} will hold your calendar, clients and money. Security is part of the design, not an afterthought.</p>
          </Reveal>
          <Reveal delay={100}>
            <ul className="space-y-3">
              {security.map((s) => (
                <li key={s} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
                  <Icon name="check" className="mt-0.5 shrink-0 text-good" />
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6" aria-labelledby="faq-title">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-surface p-5 open:border-accent">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="cta-title">
        <Reveal className="rounded-3xl border border-line bg-surface p-8 text-center sm:p-14">
          <h2 id="cta-title" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Get early access</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">Join the waitlist for the first invites and early-bird pricing.</p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <WaitlistForm source="home-footer" />
          </div>
        </Reveal>
      </section>
    </>
  );
}
