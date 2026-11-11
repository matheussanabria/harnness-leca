// Turns an SVG data URL into a PNG data URL in the browser. The asset endpoint refuses SVG, and Mermaid diagrams the
// converter cannot draw as shapes arrive as SVG images, so they are stored as PNG instead of being dropped.
const TARGET_SIDE = 4096; // the longest side aims for this many pixels, so the board stays sharp at high zoom
const MIN_SCALE = 2;
const MAX_SIDE = 8192; // stays inside browser canvas limits
const MAX_PIXELS = 24_000_000; // keeps memory and the PNG size reasonable

export async function rasterizeSvg(dataUrl: string): Promise<string | null> {
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const wanted = Math.max(MIN_SCALE, TARGET_SIDE / Math.max(width, height));
  const scale = Math.min(wanted, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png"); // throws if the canvas is tainted; the session treats that as unsupported
}
