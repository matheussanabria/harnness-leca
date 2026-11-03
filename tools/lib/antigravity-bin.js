// @ts-check
// Resolves the absolute path to the Antigravity CLI executable (agy / agy.exe).
// Checks in order:
// 1. Explicit environment variable: AGY_BIN or ANTIGRAVITY_BIN
// 2. Default installation path: ~/.gemini/bin/agy[.exe]
// 3. Absolute directories on PATH
const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadEnv } = require("./env");

const WIN = process.platform === "win32";

/** @param {string} p */
const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const pathDirs = () =>
  String(process.env.PATH || "")
    .split(path.delimiter)
    .map((d) => d.replace(/^"|"$/g, ""))
    .filter((d) => d && path.isAbsolute(d));

/** @type {string | null | undefined} */
let cached;

function resolveAgyBin() {
  if (cached !== undefined) return cached;
  loadEnv();

  const fromEnv = process.env.AGY_BIN || process.env.ANTIGRAVITY_BIN;
  if (fromEnv && path.isAbsolute(fromEnv) && isFile(fromEnv)) {
    return (cached = fromEnv);
  }

  const defaultExe = path.join(os.homedir(), ".gemini", "bin", WIN ? "agy.exe" : "agy");
  if (isFile(defaultExe)) {
    return (cached = defaultExe);
  }

  const exeName = WIN ? "agy.exe" : "agy";
  for (const dir of pathDirs()) {
    const candidate = path.join(dir, exeName);
    if (isFile(candidate)) return (cached = candidate);
  }

  return (cached = null);
}

function resetAgyBin() {
  cached = undefined;
}

module.exports = { resolveAgyBin, resetAgyBin };

