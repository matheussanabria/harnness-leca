// Vite plugin: copies Excalidraw's fonts into dist/excalidraw/fonts so the board island never reads a CDN.
// The island sets window.EXCALIDRAW_ASSET_PATH to "/dist/excalidraw/" (see islands/canvas-board/lazyCanvas.ts).
import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

export function excalidrawAssets(): Plugin {
  return {
    name: "harness-excalidraw-assets",
    writeBundle(options) {
      const entry = createRequire(import.meta.url).resolve("@excalidraw/excalidraw");
      const fonts = join(dirname(entry), "fonts");
      if (!existsSync(fonts) || !options.dir) throw new Error(`Excalidraw fonts not found at ${fonts}`);
      cpSync(fonts, join(options.dir, "excalidraw", "fonts"), { recursive: true });
    },
  };
}
