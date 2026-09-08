import type { MetadataRoute } from "next";
import { SEO_SITE, isProductionSeoDeployment } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionSeoDeployment()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    host: SEO_SITE.origin,
    sitemap: `${SEO_SITE.origin}/sitemap.xml`,
  };
}
