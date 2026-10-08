import type { MetadataRoute } from "next";
import { SEO_SITE } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SEO_SITE.origin}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${SEO_SITE.origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
