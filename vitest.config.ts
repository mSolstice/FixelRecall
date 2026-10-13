import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@fixel-recall/core": "/packages/core/src/index.ts",
      "@fixel-recall/providers-anthropic": "/packages/providers-anthropic/src/index.ts",
      "@fixel-recall/providers-openai": "/packages/providers-openai/src/index.ts",
      "@fixel-recall/renderer": "/packages/renderer/src/index.ts"
    }
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false
  }
});
