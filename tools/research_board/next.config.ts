import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The release check builds into a separate directory so a running dev server is not disturbed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
};

export default nextConfig;
