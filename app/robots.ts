import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Everything except the marketing pages sits behind sign-in, so keep crawlers on the public ones. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/guides/", "/llms.txt"],
        disallow: [
          "/api/",
          "/auth/",
          "/today",
          "/problems",
          "/practice",
          "/review/",
          "/stats",
          "/settings",
          "/import",
          "/roadmap",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
