// File name for exports: title made safe for downloads, with the format extension.
export function exportFileName(title: string, ext: "png" | "svg"): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return `${base || "board"}.${ext}`;
}
