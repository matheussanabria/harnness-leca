// Builds every React island under src/islands/<name>/main.tsx into ui/public/dist (ADR-011).
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { excalidrawAssets } from "./build/excalidraw-assets";
import { islandsIndex } from "./build/islands-index";

const root = import.meta.dirname;
const islandsDir = resolve(root, "src/islands");
const input = Object.fromEntries(
  readdirSync(islandsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, resolve(islandsDir, entry.name, "main.tsx")]),
);

export default defineConfig({
  root,
  base: "/dist/",
  plugins: [react(), islandsIndex(), excalidrawAssets()],
  build: {
    outDir: resolve(root, "../public/dist"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      input,
      preserveEntrySignatures: "exports-only",
      output: {
        entryFileNames: "islands/[name]-[hash].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
