import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure rules in lib/. The Playwright specs, if any, run under their own runner.
// The "@" alias mirrors tsconfig.json so a test can load a module that imports "@/lib/…", with its
// database stubbed (see lib/__tests__/submit-proof.test.ts).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/**/*.test.ts"] },
});
