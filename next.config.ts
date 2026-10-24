import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "microphone=(), camera=(), geolocation=()" },
          // A fictional-data demo: keep it out of search indexes.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // Posters, card stills and photos: a repeat visit paints them from cache, and a redeploy refreshes them within a day.
      ...["/posters/:file*", "/renders/:file*", "/brand/:file*", "/fonts/:file*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
};

export default nextConfig;
