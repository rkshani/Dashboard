import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/Reveal";
import { Icon } from "@/components/Sections";
import { WaitlistForm } from "@/components/WaitlistForm";
import { roles, site } from "@/lib/site";

export function generateStaticParams() {
  return roles.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/for/[role]">): Promise<Metadata> {
  const { role } = await params;
  const r = roles.find((x) => x.slug === role);
  if (!r) return {};
  return {
    title: r.headline,
    description: `${r.summary} ${site.name} gives ${r.plural} one dashboard for everything.`,
    alternates: { canonical: `/for/${r.slug}` },
    openGraph: { title: r.headline, description: r.summary, url: `/for/${r.slug}` },
  };
}

export default async function RolePage({ params }: PageProps<"/for/[role]">) {
  const { role } = await params;
  const r = roles.find((x) => x.slug === role);
  if (!r) notFound();

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: site.url },
      { "@type": "ListItem", position: 2, name: `For ${r.plural}`, item: `${site.url}/for/${r.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <section className="mx-auto max-w-4xl px-4 pb-12 pt-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="anim-rise text-sm text-muted">
          <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden="true">/</span> For {r.plural}
        </nav>
        <span className={`anim-rise mt-6 inline-block rounded-full px-3 py-1 text-xs font-semibold ${r.status === "launching" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>
          {r.status === "launching" ? "Launching first" : "Coming after launch"}
        </span>
        <h1 className="anim-rise mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl" style={{ animationDelay: "0.05s" }}>
          {r.headline}
        </h1>
        <p className="anim-rise mt-5 text-lg text-muted" style={{ animationDelay: "0.1s" }}>{r.summary}</p>
        <div className="anim-rise mt-8" style={{ animationDelay: "0.15s" }}>
          <WaitlistForm defaultRole={r.slug} source={`role-${r.slug}`} />
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-2" aria-label="Details">
        <Reveal className="h-full rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-semibold">Sound familiar?</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {r.pains.map((p) => (
              <li key={p} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden="true" />{p}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={80} className="h-full rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-semibold">What your dashboard includes</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {r.modules.map((m) => (
              <li key={m} className="flex items-center gap-3"><Icon name="check" className="shrink-0 text-good" />{m}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="rounded-2xl border border-line bg-surface p-6 md:col-span-2">
          <h2 className="font-display text-xl font-semibold">Your opportunity feed</h2>
          <p className="mt-2 text-muted">{r.feed} Postings are collected from approved public sources, de-duplicated and scored against your profile, then delivered in your morning digest.</p>
        </Reveal>
      </section>
    </>
  );
}
