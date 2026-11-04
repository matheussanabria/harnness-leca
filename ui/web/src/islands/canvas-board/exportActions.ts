// PNG and SVG export through Excalidraw's export utils. The package is imported dynamically (same lazy chunk).
// SVG is only ever downloaded: the asset endpoint rejects SVG uploads.
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { exportFileName } from "../../features/board/exportName.ts";
import { downloadBlob } from "./dataUrl";
import type { ShellTheme } from "./useShellTheme";

export type ExportKind = "png" | "svg";

export async function exportBoard(
  api: ExcalidrawImperativeAPI,
  kind: ExportKind,
  title: string,
  theme: ShellTheme,
): Promise<void> {
  const { exportToBlob, exportToSvg } = await import("@excalidraw/excalidraw");
  const elements = api.getSceneElements();
  const files = api.getFiles();
  const appState = { ...api.getAppState(), exportBackground: true, exportWithDarkMode: theme === "dark" };
  if (kind === "png") {
    const blob = await exportToBlob({ elements, appState, files, mimeType: "image/png" });
    downloadBlob(blob, exportFileName(title, "png"));
    return;
  }
  const svg = await exportToSvg({ elements, appState, files });
  const text = new XMLSerializer().serializeToString(svg);
  downloadBlob(new Blob([text], { type: "image/svg+xml" }), exportFileName(title, "svg"));
}
