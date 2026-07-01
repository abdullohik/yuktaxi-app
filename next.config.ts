import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" removed — Vercel handles output format automatically
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;