import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@context-diet/core": "/packages/core/src/index.ts",
      "@context-diet/providers-anthropic": "/packages/providers-anthropic/src/index.ts",
      "@context-diet/providers-openai": "/packages/providers-openai/src/index.ts",
      "@context-diet/renderer": "/packages/renderer/src/index.ts"
    }
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false
  }
});
