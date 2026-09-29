import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
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
]);

export default eslintConfig;
