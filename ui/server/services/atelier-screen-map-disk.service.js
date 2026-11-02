// @ts-check
// Disk adapter for the screen map: reads proto.json and screens/*.html of one prototype, then delegates to the pure
// builder in atelier-screen-map.service.js. Read-only; a missing prototype yields an empty map, never an exception.
const fs = require("fs");
const path = require("path");
const { buildScreenMap } = require("./atelier-screen-map.service");

function readText(/** @type {string} */ file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * @param {{ projectDir: string, protoId: string }} ctx
 */
async function loadScreenMap({ projectDir, protoId }) {
  const protoDir = path.join(projectDir, "design", "prototypes", protoId);
  const screensDir = path.join(protoDir, "screens");
  let names = [];
  try {
    names = fs.readdirSync(screensDir).filter((f) => f.endsWith(".html")).sort();
  } catch {
    /* no screens yet */
  }
  let manifest = null;
  try {
    manifest = JSON.parse(readText(path.join(protoDir, "proto.json")));
  } catch {
    /* unreadable proto.json: continue with the disk only */
  }
  const files = names.map((f) => ({ id: f.replace(/\.html$/, ""), html: readText(path.join(screensDir, f)) }));
  return buildScreenMap({ protoId, manifest, files });
}

module.exports = { loadScreenMap };
