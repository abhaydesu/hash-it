import type { MetadataRoute } from "next";
import { GUIDE_PATH, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${GUIDE_PATH}`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
