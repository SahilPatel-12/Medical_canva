import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@design-platform/ui",
    "@design-platform/editor",
    "@design-platform/types",
    "@design-platform/api-client",
    "@design-platform/auth",
    "@design-platform/database",
    "@design-platform/storage",
    "@design-platform/config",
    "@design-platform/utils",
  ],
};

export default nextConfig;
