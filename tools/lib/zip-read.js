// @ts-check
// Minimal ZIP reader (stored and deflate entries) on top of node:zlib, so the tools stay dependency-free.
// Enough for the claude.ai data export zips. ZIP64 archives and encrypted entries are rejected.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/** Finds the end-of-central-directory record (it sits in the last 64 KB + 22 bytes). */
function findEocd(fd, size) {
  const len = Math.min(size, 65557);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len);
  for (let i = len - 22; i >= 0; i--) if (buf.readUInt32LE(i) === EOCD_SIG) return buf.subarray(i);
  throw new Error("not a zip file (end of central directory not found)");
}

/**
 * Lists the entries of a zip.
 * @param {string} file
 * @returns {{ name: string, method: number, compSize: number, size: number, offset: number, flags: number }[]}
 */
function listZip(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const eocd = findEocd(fd, size);
    const count = eocd.readUInt16LE(10);
    const cdSize = eocd.readUInt32LE(12);
    const cdOffset = eocd.readUInt32LE(16);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new Error("ZIP64 archives are not supported");
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOffset);
    const entries = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== CEN_SIG) throw new Error("corrupt central directory");
      const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32);
      entries.push({
        flags: cd.readUInt16LE(p + 8),
        method: cd.readUInt16LE(p + 10),
        compSize: cd.readUInt32LE(p + 20),
        size: cd.readUInt32LE(p + 24),
        offset: cd.readUInt32LE(p + 42),
        name: cd.toString("utf8", p + 46, p + 46 + nameLen),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

/** Reads one entry's bytes. */
function readEntry(fd, e) {
  if (e.flags & 1) throw new Error(`encrypted entry: ${e.name}`);
  const head = Buffer.alloc(30);
  fs.readSync(fd, head, 0, 30, e.offset);
  if (head.readUInt32LE(0) !== LOC_SIG) throw new Error(`corrupt local header: ${e.name}`);
  const start = e.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const data = Buffer.alloc(e.compSize);
  fs.readSync(fd, data, 0, e.compSize, start);
  if (e.method === 0) return data;
  if (e.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`unsupported compression method ${e.method}: ${e.name}`);
}

/**
 * Extracts the entries accepted by `filter` into `destDir`. Entry names that escape destDir are skipped.
 * @param {string} file
 * @param {string} destDir
 * @param {{ filter?: (name: string) => boolean, maxSize?: number }} [opts]
 * @returns {string[]} written file paths
 */
function extractZip(file, destDir, { filter = () => true, maxSize = Infinity } = {}) {
  const root = path.resolve(destDir);
  const written = [];
  const entries = listZip(file).filter((e) => !e.name.endsWith("/") && filter(e.name));
  const fd = fs.openSync(file, "r");
  try {
    for (const e of entries) {
      const out = path.resolve(root, e.name);
      if (out !== root && !out.startsWith(root + path.sep)) continue; // zip-slip guard
      if (e.size > maxSize) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, readEntry(fd, e));
      written.push(out);
    }
  } finally {
    fs.closeSync(fd);
  }
  return written;
}

/**
 * Reads one entry (matched by its base name) into memory, or returns null when absent.
 * @param {string} file
 * @param {(name: string) => boolean} match
 */
function readZipEntry(file, match) {
  const e = listZip(file).find((x) => !x.name.endsWith("/") && match(x.name));
  if (!e) return null;
  const fd = fs.openSync(file, "r");
  try {
    return readEntry(fd, e);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { listZip, extractZip, readZipEntry };
