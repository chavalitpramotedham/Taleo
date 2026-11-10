import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The library's old address: a real permanent redirect (308), answered
  // before any page is rendered, so search engines move the address over.
  async redirects() {
    return [{ source: "/library", destination: "/store", permanent: true }];
  },
  async headers() {
    // The paintings and pictures the pages are made of: kept by the browser
    // for a week (and shown from its copy while a newer one is fetched), so
    // a returning reader's page doesn't ask about each of them again.
    const kept = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    return [
      { source: "/art/:path*", headers: kept },
      { source: "/steps/:path*", headers: kept },
      { source: "/about/:path*", headers: kept },
      {
        // The service worker: always checked afresh (a browser must never
        // hold on to an old one), and allowed to run only our own code.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
