import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@casid/core"],
  reactStrictMode: true,
  allowedDevOrigins: ["13.140.188.185"],
};

export default nextConfig;
