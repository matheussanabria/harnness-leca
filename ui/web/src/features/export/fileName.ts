// Safe download file name: the title without unsafe characters, plus the format extension.
export function safeFileName(title: string, ext: string, fallback: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return `${base || fallback}.${ext}`;
}
