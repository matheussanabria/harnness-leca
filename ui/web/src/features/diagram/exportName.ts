// File name for diagram exports: the title made safe for downloads, with the format extension.
import { safeFileName } from "../export/fileName.ts";

export type DiagramExportExt = "svg" | "png" | "mmd" | "md";

export function diagramFileName(title: string, ext: DiagramExportExt): string {
  return safeFileName(title, ext, "diagram");
}
