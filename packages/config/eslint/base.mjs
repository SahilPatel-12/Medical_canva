import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export const baseConfig = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
    "**/next-env.d.ts",
    "**/*.d.ts",
  ]),
  ...tseslint.configs.recommended,
]);

export default baseConfig;
