import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.resolve(currentDir, "..");

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "ts"),
      "@examples": path.resolve(rootDir, "examples"),
    },
  },
});
