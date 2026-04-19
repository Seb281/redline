import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist uses Node-incompatible browser globals; keep it out of the
  // Server Components bundle so any accidental server-side import fails
  // loudly at build time instead of silently shipping a broken worker.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
