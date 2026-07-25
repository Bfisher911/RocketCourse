import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // Vite 8 is rolldown-based: `build.rollupOptions` is deprecated in favour of
    // `build.rolldownOptions`, and within it rolldown 1.x deprecates BOTH
    // `output.manualChunks` and `output.advancedChunks` in favour of
    // `output.codeSplitting.groups` (verified against the installed typings in
    // rolldown/dist/shared/define-config-*.d.mts, not the docs).
    //
    // NOTE: tsconfig.node.json must keep emitting to node_modules/.tmp. Without
    // that, `tsc -b` writes a vite.config.js next to this file and Vite resolves
    // .js BEFORE .ts — everything here would be silently ignored, with no error.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React changes on our upgrade schedule, not on every app deploy, so
            // giving it a stable chunk means a normal release only invalidates
            // the app chunk and this one keeps being served from cache. It does
            // NOT shrink the first load — React is required to render anything.
            // Use [\\/] rather than / so the pattern also matches Windows paths.
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30
            }
          ]
        }
      }
    }
  },
  test: {
    environment: "node",
    // Heavy integration-style tests (full course generation + .imscc zip build +
    // QTI parse) can blow past vitest's 5000ms default under cold-cache,
    // parallel-fork load — exactly the condition CI runs in — which surfaced as
    // intermittent "Test timed out in 5000ms" flakes in the deploy gate. Give the
    // whole suite generous headroom so transform-storm CPU starvation can't trip it.
    testTimeout: 30000
  }
});
