import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.resolve(currentDir, "..");

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          fabric: ["fabric"],
          ocr: ["tesseract.js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "ts"),
      "@examples": path.resolve(rootDir, "examples"),
    },
  },
  server: {
    fs: {
      allow: [rootDir],
    },
  },
});
