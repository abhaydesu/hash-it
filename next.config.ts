import type { NextConfig } from "next";
import { GUIDE_PATH, LEGACY_GUIDE_PATH } from "./lib/site";

const nextConfig: NextConfig = {
  // Put <title>, description, canonical and Open Graph tags in <head> for every client.
  // By default Next streams them into <body> for anyone not on its bot list, which
  // includes AI crawlers (GPTBot, ClaudeBot, PerplexityBot). All metadata here is static,
  // so rendering it up front costs nothing.
  htmlLimitedBots: /.*/,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Keep visited pages in the client router cache for 30s so switching back to a tab
    // is instant. Every mutating server action calls revalidatePath/revalidateTag, which
    // clears this cache, so a user never sees their own changes stale.
    staleTimes: {
      dynamic: 30,
    },
  },
  // The guide moved from a LeetCode URL to a DSA one; keep old links and rankings.
  redirects: async () => [
    { source: LEGACY_GUIDE_PATH, destination: GUIDE_PATH, permanent: true },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ],
};

export default nextConfig;
