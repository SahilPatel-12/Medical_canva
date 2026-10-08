import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@design-platform/ui",
    "@design-platform/types",
    "@design-platform/api-client",
    "@design-platform/config",
    "@design-platform/utils",
  ],
};

export default nextConfig;
