// Small pure helpers over an SVG string (EP-21.03): its natural size and a data URL for it.

const FALLBACK = { width: 800, height: 600 } as const;

/** Natural size from the viewBox (Mermaid sets `max-width` and a viewBox, not width and height in pixels). */
export function svgSize(svg: string): { width: number; height: number } {
  const match = /viewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  const width = Number(match?.[3]);
  const height = Number(match?.[4]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width: Math.ceil(width), height: Math.ceil(height) }
    : { ...FALLBACK };
}

/** Standalone SVG file text: adds the XML namespace when missing and a fixed pixel size from the viewBox. */
export function standaloneSvg(svg: string): string {
  const { width, height } = svgSize(svg);
  const withNs = /<svg[^>]*\sxmlns="/.test(svg) ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return withNs
    .replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1")
    .replace("<svg", `<svg width="${width}" height="${height}"`);
}

/** `data:image/svg+xml` URL, UTF-8 safe, used to draw the SVG into a canvas for the PNG export. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standaloneSvg(svg))}`;
}
