import { defineConfig } from "vitest/config";
import path from "node:path";

const pdfjsLegacy = path.resolve(
  __dirname,
  "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
);

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // pdfjs-dist legacy build pulls ~1MB of ESM and takes 5–20s to
    // evaluate on a cold start under jsdom; default 5s is too tight.
    // 20s occasionally still trips on the barrel-import smoke test.
    testTimeout: 30000,
    // pdfjs-dist ships ESM that vitest cannot transform through the default
    // externalisation path under jsdom; inlining keeps the worker stub path
    // resolvable during the redact-export tests.
    server: {
      deps: {
        inline: ["pdfjs-dist"],
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // The modern pdfjs-dist entry reaches for DOMMatrix/Path2D at module
      // load and blows up under jsdom. The legacy build is the upstream
      // recommendation for Node-hosted test environments. Browser builds
      // (next dev/build) resolve the package normally and get the modern
      // entry — this alias is test-scope only.
      { find: /^pdfjs-dist$/, replacement: pdfjsLegacy },
    ],
  },
});
