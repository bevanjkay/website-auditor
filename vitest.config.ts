import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@website-auditor/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@website-auditor/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
      "@website-auditor/audit-engine": fileURLToPath(new URL("./packages/audit-engine/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
