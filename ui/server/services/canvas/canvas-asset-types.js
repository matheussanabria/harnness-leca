// @ts-check
const { unsupportedAssetType } = require("./canvas-errors");

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_BOARD_ASSETS_BYTES = 200 * 1024 * 1024;
const MAX_ASSET_NAME_LENGTH = 120;

// Only these extensions may ever appear in a stored asset file name.
const ASSET_FILE_RE = /^([0-9a-f]{64})\.(png|jpg|gif|webp|pdf|txt|md|csv|json)$/;

/** @type {Readonly<Record<string, string>>} */
const MIME_BY_EXT = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
});

// Only raster images and never SVG/HTML: those execute script when opened.
const INLINE_EXTS = new Set(["png", "jpg", "gif", "webp"]);
const TEXT_EXTS = ["txt", "md", "csv", "json"];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

/**
 * @param {string} ext
 * @returns {{ ext: string, mime: string, inline: boolean }}
 */
function assetType(ext) {
  return { ext, mime: MIME_BY_EXT[ext], inline: INLINE_EXTS.has(ext) };
}

/**
 * @param {Buffer} bytes
 * @param {number} offset
 * @param {string} text
 * @returns {boolean}
 */
function matchesAscii(bytes, offset, text) {
  if (bytes.length < offset + text.length) return false;
  return bytes.toString("latin1", offset, offset + text.length) === text;
}

/**
 * Type from magic bytes only. Text formats have no signature and return null.
 * @param {Buffer} bytes
 * @returns {string | null}
 */
function detectMagicExt(bytes) {
  if (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (matchesAscii(bytes, 0, "GIF87a") || matchesAscii(bytes, 0, "GIF89a")) return "gif";
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) return "webp";
  if (matchesAscii(bytes, 0, "%PDF-")) return "pdf";
  return null;
}

/**
 * The client name is consulted only for the four text extensions.
 * @param {string} name
 * @returns {"txt" | "md" | "csv" | "json" | null}
 */
function textExtForName(name) {
  const lower = name.toLowerCase();
  for (const ext of TEXT_EXTS) {
    if (lower.endsWith(`.${ext}`)) return /** @type {"txt" | "md" | "csv" | "json"} */ (ext);
  }
  return null;
}

/**
 * Valid UTF-8 with no NUL byte; JSON must also parse.
 * @param {Buffer} bytes
 * @param {string} ext
 * @returns {boolean}
 */
function isValidText(bytes, ext) {
  if (bytes.includes(0)) return false;
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) return false;
  if (ext === "json") {
    try {
      JSON.parse(text);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Resolve the stored type from the bytes, falling back to text by client name.
 * @param {Buffer} bytes
 * @param {unknown} name
 * @returns {{ ext: string, mime: string, inline: boolean }}
 */
function detectAssetType(bytes, name) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw unsupportedAssetType();
  const magic = detectMagicExt(bytes);
  if (magic) return assetType(magic);
  // The name is trimmed of control characters before the extension is read,
  // but it is never truncated: the extension always stays visible.
  const cleanName = typeof name === "string" ? name.replace(CONTROL_RE, "").trim() : "";
  const ext = textExtForName(cleanName);
  if (ext && isValidText(bytes, ext)) return assetType(ext);
  throw unsupportedAssetType();
}

/**
 * Names are display-only: they never take part in a filesystem path.
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeAssetName(value) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_RE, "").trim().slice(0, MAX_ASSET_NAME_LENGTH);
}

module.exports = {
  ASSET_FILE_RE,
  MIME_BY_EXT,
  INLINE_EXTS,
  TEXT_EXTS,
  MAX_ASSET_BYTES,
  MAX_BOARD_ASSETS_BYTES,
  MAX_ASSET_NAME_LENGTH,
  detectAssetType,
  detectType: detectAssetType,
  detectMagicExt,
  sanitizeAssetName,
};
