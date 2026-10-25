"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function removeDir(dir) {
  if (!dir) return;
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function makeTempDir(prefix, t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  if (t && typeof t.after === "function") t.after(() => removeDir(dir));
  return dir;
}

module.exports = { makeTempDir, removeDir };
