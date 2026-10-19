import { faqs, roles, site } from "@/lib/site";

/** /llms.txt — a plain summary for AI assistants and answer engines (GEO/AEO). */
export function GET() {
  const body = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "## Pages",
    `- [Home](${site.url}/): overview, features, how it works, FAQ, waitlist`,
    ...roles.map((r) => `- [For ${r.plural}](${site.url}/for/${r.slug}): ${r.summary}${r.status === "planned" ? " (coming after launch)" : ""}`),
    `- [Privacy](${site.url}/privacy)`,
    "",
    "## FAQ",
    ...faqs.flatMap((f) => [`### ${f.q}`, f.a, ""]),
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
