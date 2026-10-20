import type { MetadataRoute } from "next";
import { roles, site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-10-20"); // bump when content changes
  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...roles.map((r) => ({
      url: `${site.url}/for/${r.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: r.status === "launching" ? 0.9 : 0.6,
    })),
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
