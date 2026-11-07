// Turns an SVG data URL into a PNG data URL in the browser. The asset endpoint refuses SVG, and Mermaid diagrams the
// converter cannot draw as shapes arrive as SVG images, so they are stored as PNG instead of being dropped.
const SCALE = 2; // sharper text when zoomed in
const MAX_SIDE = 8192; // stays inside browser canvas limits

export async function rasterizeSvg(dataUrl: string): Promise<string | null> {
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const scale = Math.min(SCALE, MAX_SIDE / width, MAX_SIDE / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png"); // throws if the canvas is tainted; the session treats that as unsupported
}
