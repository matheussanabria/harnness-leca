// @ts-check
const { CanvasError, assetTooLarge, invalidBody } = require("./canvas-errors");

/**
 * Read a raw request body, refusing to buffer more than maxBytes.
 * The declared Content-Length is checked before any chunk is read and the
 * running size is checked again while streaming.
 * @param {import("node:http").IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
async function readBinaryBody(req, maxBytes) {
  const headers = req.headers || {};
  const declaredHeader = headers["content-length"];
  const declared = Array.isArray(declaredHeader) ? declaredHeader[0] : declaredHeader;
  const declaredBytes = typeof declared === "string" && declared.trim() !== "" ? Number(declared) : NaN;
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) throw assetTooLarge();

  // destroyOnReturn:false keeps the request socket alive so the 413 response
  // can still be written; the remaining bytes are discarded by the server.
  const source =
    typeof /** @type {any} */ (req).iterator === "function"
      ? /** @type {any} */ (req).iterator({ destroyOnReturn: false })
      : req;

  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      // Stop consuming as soon as the limit is crossed: nothing else is buffered.
      if (size > maxBytes) throw assetTooLarge();
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof CanvasError) throw error;
    throw invalidBody();
  }
  return Buffer.concat(chunks, size);
}

module.exports = { readBinaryBody };
