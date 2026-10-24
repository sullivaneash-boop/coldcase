import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The release check builds into a separate directory so a running dev server is not disturbed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pin the workspace root to this app so stray lockfiles elsewhere on the machine
  // (e.g. ~/package-lock.json) never make the build trace files outside the project.
  outputFileTracingRoot: path.join(__dirname),
  // Lint runs as its own release-check step (`eslint src scripts pipeline tests`); next build's
  // embedded lint pass is skipped. Type checking still runs during next build.
  eslint: { ignoreDuringBuilds: true },
  devIndicators: false,
};

export default nextConfig;
