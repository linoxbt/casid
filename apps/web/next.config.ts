import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@casid/core"],
  reactStrictMode: true,
};

export default nextConfig;
