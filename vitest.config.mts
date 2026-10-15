import { defineConfig } from "vitest/config";

// Unit tests for the pure rules in lib/. The Playwright specs, if any, run under their own runner.
export default defineConfig({
  test: { include: ["lib/**/*.test.ts"] },
});
