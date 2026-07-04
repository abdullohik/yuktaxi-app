import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Railway deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
