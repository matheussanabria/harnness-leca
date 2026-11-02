// @ts-check
"use strict";
/**
 * Pixel diff of two PNG buffers, computed inside a browser page with a canvas (no image library needed).
 * A pixel differs when any colour channel moves by more than `tolerance` (0-255).
 */

/** Runs in the page. Receives base64 PNGs, returns the mismatch figures and a diff PNG (red = changed). */
async function diffInPage({ a, b, tolerance }) {
  const load = (b64) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image failed to decode"));
      img.src = `data:image/png;base64,${b64}`;
    });
  const [imgA, imgB] = await Promise.all([load(a), load(b)]);
  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);
  const pixels = (img) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const pa = pixels(imgA);
  const pb = pixels(imgB);
  const out = new ImageData(width, height);
  let changed = 0;
  for (let i = 0; i < out.data.length; i += 4) {
    // Area outside one image is transparent black there, so it differs from any rendered content.
    const delta = Math.max(
      Math.abs(pa[i] - pb[i]),
      Math.abs(pa[i + 1] - pb[i + 1]),
      Math.abs(pa[i + 2] - pb[i + 2]),
      Math.abs(pa[i + 3] - pb[i + 3]),
    );
    if (delta > tolerance) {
      changed += 1;
      out.data.set([255, 0, 0, 255], i);
    } else {
      out.data.set([pa[i], pa[i + 1], pa[i + 2], 50], i);
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(out, 0, 0);
  return {
    width,
    height,
    changed,
    ratio: changed / (width * height),
    sizeMismatch: imgA.width !== imgB.width || imgA.height !== imgB.height,
    sizeA: [imgA.width, imgA.height],
    sizeB: [imgB.width, imgB.height],
    diffPng: canvas.toDataURL("image/png").split(",")[1],
  };
}

/**
 * @param {import("playwright-core").Browser} browser
 * @param {Buffer} baseline
 * @param {Buffer} current
 * @param {{ tolerance?: number }} [opts]
 */
async function diffPngs(browser, baseline, current, opts = {}) {
  const page = await browser.newPage();
  try {
    const r = await page.evaluate(diffInPage, {
      a: baseline.toString("base64"),
      b: current.toString("base64"),
      tolerance: opts.tolerance ?? 16,
    });
    return { ...r, diffPng: Buffer.from(r.diffPng, "base64") };
  } finally {
    await page.close();
  }
}

module.exports = { diffPngs };
