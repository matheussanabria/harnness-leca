// @ts-nocheck
// Runs INSIDE the headless browser of a motion export job (EP-24.05), never in Node and never on the public server:
// motion-export-encode.service.js serves it, with mediabunny and gifenc, through page.route on a localhost origin
// (WebCodecs needs a secure context). Frames arrive one at a time as base64 PNG, so memory stays flat.
import { Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource, QUALITY_HIGH, canEncodeVideo } from "./mediabunny.mjs";
import { GIFEncoder, quantize, applyPalette } from "./gifenc.esm.js";

const CODEC = { mp4: "avc", webm: "vp9" };
let job = null;

function bytesFromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function base64FromBytes(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

window.__encoder = {
  /** Formats this browser can produce at the given size. */
  async probe(width = 1280, height = 720) {
    const out = { gif: true };
    for (const [format, codec] of Object.entries(CODEC)) {
      try { out[format] = await canEncodeVideo(codec, { width, height, bitrate: QUALITY_HIGH }); } catch { out[format] = false; }
    }
    return out;
  },

  async start({ format, width, height, fps }) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: format === "gif" });
    job = { format, width, height, fps, canvas, ctx, frames: 0 };
    if (format === "gif") {
      job.gif = GIFEncoder();
      return;
    }
    if (!CODEC[format]) throw new Error(`unknown format ${format}`);
    job.target = new BufferTarget();
    job.output = new Output({
      format: format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
      target: job.target,
    });
    job.source = new CanvasSource(canvas, { codec: CODEC[format], bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
    job.output.addVideoTrack(job.source, { frameRate: fps });
    await job.output.start();
  },

  async frame(b64, index) {
    if (!job) throw new Error("encoder not started");
    const bitmap = await createImageBitmap(new Blob([bytesFromBase64(b64)], { type: "image/png" }));
    job.ctx.drawImage(bitmap, 0, 0, job.width, job.height);
    bitmap.close();
    if (job.gif) {
      const { data } = job.ctx.getImageData(0, 0, job.width, job.height);
      const palette = quantize(data, 256);
      job.gif.writeFrame(applyPalette(data, palette), job.width, job.height, { palette, delay: Math.round(1000 / job.fps) });
    } else {
      await job.source.add(index / job.fps, 1 / job.fps);
    }
    job.frames += 1;
    return job.frames;
  },

  async finish() {
    if (!job) throw new Error("encoder not started");
    let bytes;
    if (job.gif) {
      job.gif.finish();
      bytes = job.gif.bytes();
    } else {
      await job.output.finalize();
      bytes = new Uint8Array(job.target.buffer);
    }
    job = null;
    return base64FromBytes(bytes);
  },

  async cancel() {
    try { await job?.output?.cancel(); } catch { /* already finished or never started */ }
    job = null;
  },
};
window.__encoderReady = true;
