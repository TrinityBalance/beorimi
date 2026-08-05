import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.10.0.170"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
