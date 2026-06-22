import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright"],
  basePath: "/jobboard",
  allowedDevOrigins: ["mini-dev.test", "192.168.4.20", "100.93.12.99"],
  env: {
    NEXT_PUBLIC_BASE_PATH: "/jobboard",
  },
};

export default nextConfig;
