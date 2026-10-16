import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  console: "readonly",
  fetch: "readonly",
  process: "readonly"
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/bundle/**",
      "**/npm-package/**",
      "coverage/**",
      ".pnpm-store/**",
      "node_modules/**",
      "**/*.d.ts"
    ]
  },
  {
    languageOptions: {
      globals: nodeGlobals
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
);
