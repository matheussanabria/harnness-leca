// PNG export of a rendered diagram (EP-21.03): draws the sanitized SVG into a canvas. Browser only.
import { svgDataUrl, svgSize } from "./svg.ts";

const MAX_SIDE = 8192;

/** Scale that keeps the longest side of the PNG within MAX_SIDE (very large diagrams are scaled down, never failed). */
export function pngScale(width: number, height: number, wanted: number): number {
  const longest = Math.max(width, height) * wanted;
  return longest > MAX_SIDE ? MAX_SIDE / Math.max(width, height) : wanted;
}

/** `background` fills the transparent areas, so the PNG is readable on a dark page as well. */
export async function svgToPng(svg: string, options: { scale?: number; background?: string } = {}): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const scale = pngScale(width, height, options.scale ?? 2);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível desenhar o diagrama para o PNG."));
  });
  image.src = svgDataUrl(svg);
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não permite exportar PNG.");
  context.fillStyle = options.background ?? "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o PNG."))), "image/png");
  });
}
