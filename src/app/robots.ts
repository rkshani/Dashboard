import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// AI crawlers are allowed on purpose: being cited by AI search (GEO) is a goal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
