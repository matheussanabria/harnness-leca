// File name for board exports: title made safe for downloads, with the format extension.
import { safeFileName } from "../export/fileName.ts";

export function exportFileName(title: string, ext: "png" | "svg"): string {
  return safeFileName(title, ext, "board");
}
