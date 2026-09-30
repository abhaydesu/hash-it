import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
