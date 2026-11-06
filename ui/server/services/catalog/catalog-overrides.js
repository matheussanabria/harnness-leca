// @ts-check
// Manual area choices, stored in global/catalog-areas.json as { "<kind>:<name>": "<areaId>" }.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { isAreaId } = require("./catalog-areas");

const FILE = path.join(ROOT, "global", "catalog-areas.json");
const KEY = /^(skill|agent):[\w.-]{1,80}$/;

/** @param {string} [file] */
function readOverrides(file = FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Saves (or clears, when areaId is null) the manual area of one item.
 * @param {string} kind "skill" or "agent"
 * @param {string} name
 * @param {string | null} areaId
 * @param {string} [file]
 */
function setOverride(kind, name, areaId, file = FILE) {
  const key = `${kind}:${name}`;
  if (!KEY.test(key)) throw new Error("Invalid item.");
  if (areaId && !isAreaId(areaId)) throw new Error("Unknown area.");
  const data = readOverrides(file);
  if (areaId) data[key] = areaId;
  else delete data[key];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
  return data;
}

module.exports = { readOverrides, setOverride, FILE };
