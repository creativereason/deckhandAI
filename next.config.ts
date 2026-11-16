import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server (screenshots, redesign work) run beside the one on :3000.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["playwright"],
  allowedDevOrigins: ["192.168.4.20"],
};

export default nextConfig;
