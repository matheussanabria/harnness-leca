// Lazy entry to the Excalidraw chunk. Fonts are served from the Vite output (plugin build/excalidraw-assets.ts),
// so the asset path must be set before the editor renders (the package reads it when it loads a font).
import { lazy } from "react";

export const EXCALIDRAW_ASSET_PATH = "/dist/excalidraw/";

export const LazyCanvas = lazy(() => {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;
  return import("./ExcalidrawCanvas");
});
