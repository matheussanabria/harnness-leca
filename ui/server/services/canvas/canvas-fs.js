// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const { corruptFile, storageError } = require("./canvas-errors");

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/**
 * @param {string} target
 * @returns {fs.Stats | null}
 */
function lstatOrNull(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return null;
    throw storageError();
  }
}

/**
 * Create the directory when missing and refuse symlinks or non-directories.
 * @param {string} dir
 */
function ensureDirectory(dir) {
  const stat = lstatOrNull(dir);
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageError();
    return;
  }
  try {
    fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  } catch {
    throw storageError();
  }
}

/**
 * @param {string} dir
 * @returns {boolean} true when the directory exists and is safe to use
 */
function directoryExists(dir) {
  const stat = lstatOrNull(dir);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageError();
  return true;
}

/**
 * @param {string} file
 * @param {number} [maxBytes]
 * @returns {boolean} true when a regular file exists
 */
function assertRegularFile(file, maxBytes = Number.MAX_SAFE_INTEGER) {
  const stat = lstatOrNull(file);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isFile()) throw storageError();
  if (stat.size > maxBytes) throw storageError();
  return true;
}

/**
 * Read and parse a JSON file. Missing files return null; malformed files throw
 * CORRUPT_FILE so callers can decide between rebuilding a cache and failing.
 * @param {string} file
 * @param {number} [maxBytes]
 * @returns {unknown}
 */
function readJsonFile(file, maxBytes = Number.MAX_SAFE_INTEGER) {
  if (!assertRegularFile(file, maxBytes)) return null;
  let text;
  try {
    text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch {
    throw storageError();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw corruptFile();
  }
}

/**
 * Write through a temp file in the same directory, then rename it into place.
 * @param {string} file
 * @param {string | Buffer} content
 */
function atomicWrite(file, content) {
  const stat = lstatOrNull(file);
  if (stat && (stat.isSymbolicLink() || !stat.isFile())) throw storageError();
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  try {
    fs.writeFileSync(tmp, content, { encoding: "utf8", mode: FILE_MODE, flag: "wx" });
    fs.renameSync(tmp, file);
  } catch {
    try { fs.unlinkSync(tmp); } catch {}
    throw storageError();
  }
}

/**
 * Copy a regular file only when the destination does not exist yet.
 * @param {string} source
 * @param {string} destination
 * @returns {boolean} true when the copy was created
 */
function copyFileIfMissing(source, destination) {
  if (assertRegularFile(destination)) return false;
  assertRegularFile(source);
  let content;
  try {
    content = fs.readFileSync(source);
  } catch {
    throw storageError();
  }
  atomicWrite(destination, content);
  return true;
}

/**
 * Move a regular file to its trash path; nothing is ever unlinked.
 * @param {string} source
 * @param {string} destination
 */
function moveFile(source, destination) {
  assertRegularFile(source);
  if (lstatOrNull(destination)) throw storageError();
  ensureDirectory(path.dirname(destination));
  try {
    fs.renameSync(source, destination);
  } catch {
    throw storageError();
  }
}

module.exports = {
  DIR_MODE,
  FILE_MODE,
  ensureDirectory,
  directoryExists,
  assertRegularFile,
  readJsonFile,
  atomicWrite,
  copyFileIfMissing,
  moveFile,
};
