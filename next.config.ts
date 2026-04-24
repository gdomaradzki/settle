import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    mcpServer: true,
    turbopackFileSystemCacheForDev: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
