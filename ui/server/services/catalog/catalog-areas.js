// @ts-check
// Areas for grouping skills and agents, and the keyword classifier that suggests one.
//
// The area list lives in data, not in code. Load order:
//   1. global/catalog-areas-config.json  (yours; edit it to add or rename areas)
//   2. catalog-areas.data.json           (bundled default)
// A config that is not valid (see validateConfig) is ignored and the default is used.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");

const DEFAULT_FILE = path.join(__dirname, "catalog-areas.data.json");
const CONFIG_FILE = path.join(ROOT, "global", "catalog-areas-config.json");
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ICON = /^fa-[a-z0-9-]{1,40}$/;

/** @typedef {{ id: string, label: string, icon: string, keywords: string[] }} Area */
/** @typedef {{ areas: Area[], other: { id: string, label: string, icon: string } }} AreaConfig */

/**
 * Returns a cleaned config, or null when the shape is wrong. Needs at least one area, unique ids,
 * an `other` fallback, FontAwesome icon names and string keywords.
 * @param {any} raw
 * @returns {AreaConfig | null}
 */
function validateConfig(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.areas) || !raw.areas.length) return null;
  const other = raw.other;
  if (!other || other.id !== "other" || typeof other.label !== "string" || !ICON.test(String(other.icon || ""))) return null;
  const ids = new Set(["other"]);
  /** @type {Area[]} */
  const areas = [];
  for (const a of raw.areas) {
    if (!a || !ID.test(String(a.id || "")) || ids.has(a.id)) return null;
    if (typeof a.label !== "string" || !a.label.trim() || a.label.length > 60) return null;
    if (!ICON.test(String(a.icon || ""))) return null;
    if (!Array.isArray(a.keywords) || a.keywords.some((k) => typeof k !== "string")) return null;
    ids.add(a.id);
    areas.push({ id: a.id, label: a.label.trim(), icon: a.icon, keywords: a.keywords.map((k) => k.toLowerCase()).filter(Boolean) });
  }
  return { areas, other: { id: "other", label: other.label, icon: other.icon } };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

/**
 * Loads the area config (custom file first, bundled default otherwise).
 * @param {{ configFile?: string, defaultFile?: string }} [opts]
 * @returns {AreaConfig & { source: "custom" | "default" }}
 */
function loadAreas(opts = {}) {
  const custom = validateConfig(readJson(opts.configFile || CONFIG_FILE));
  if (custom) return { ...custom, source: "custom" };
  const base = validateConfig(readJson(opts.defaultFile || DEFAULT_FILE));
  if (!base) throw new Error("catalog-areas.data.json is invalid.");
  return { ...base, source: "default" };
}

/**
 * Suggests an area id from the item name (weight 3) and description (weight 1).
 * Short keywords (3 chars or fewer) must match a whole word; longer ones match as substrings.
 * @param {string} name
 * @param {string} description
 * @param {AreaConfig} [config]
 * @returns {string}
 */
function classify(name, description, config = loadAreas()) {
  const nameText = String(name || "").toLowerCase();
  const descText = String(description || "").toLowerCase();
  const hit = (text, kw) => {
    if (kw.length > 3) return text.includes(kw);
    return new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text);
  };
  let best = config.other.id;
  let bestScore = 0;
  for (const area of config.areas) {
    let score = 0;
    for (const kw of area.keywords) {
      if (hit(nameText, kw)) score += 3;
      if (hit(descText, kw)) score += 1;
    }
    if (score > bestScore) {
      best = area.id;
      bestScore = score;
    }
  }
  return best;
}

/** @param {AreaConfig} [config] @returns {Array<{ id: string, label: string, icon: string }>} */
function listAreas(config = loadAreas()) {
  return [...config.areas.map(({ id, label, icon }) => ({ id, label, icon })), config.other];
}

/** @param {string} id @param {AreaConfig} [config] */
function isAreaId(id, config = loadAreas()) {
  return listAreas(config).some((a) => a.id === id);
}

module.exports = { loadAreas, validateConfig, classify, listAreas, isAreaId, CONFIG_FILE };
