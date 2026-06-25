import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright"],
  allowedDevOrigins: ["192.168.4.20"],
};

export default nextConfig;
