// Browser-only: draws an SVG string onto a canvas and returns it as a PNG blob (2x for sharpness).
const SCALE = 2;

export function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is not available"));
      context.scale(SCALE, SCALE);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the PNG"))), "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render the map"));
    };
    image.src = url;
  });
}
