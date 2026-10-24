"use strict";
// Loads and validates prices.json (data only). Memoised per file path.
const fs = require("fs");
const path = require("path");

const DEFAULT_FILE = path.join(__dirname, "prices.json");
const RATE_KEYS = ["input", "output", "cacheRead", "cacheWrite5m", "cacheWrite1h"];
const cache = new Map();

function validateTable(t) {
  const errors = [];
  const bad = (m) => errors.push(m);
  if (!t || typeof t !== "object") return ["table is not an object"];
  if (typeof t.version !== "string" || !t.version) bad("version must be a non-empty string");
  if (t.currency !== "USD") bad("currency must be USD");
  if (!t.providers || typeof t.providers !== "object") bad("providers missing");
  if (!Array.isArray(t.models) || !t.models.length) bad("models must be a non-empty array");
  for (const m of Array.isArray(t.models) ? t.models : []) {
    const id = `${m && m.provider}/${m && m.id}`;
    if (!m || typeof m.id !== "string" || typeof m.provider !== "string") { bad(`${id}: provider and id required`); continue; }
    if (!t.providers || !t.providers[m.provider]) bad(`${id}: unknown provider`);
    if (typeof m.sourceUrl !== "string" || !/^https:\/\//.test(m.sourceUrl)) bad(`${id}: sourceUrl required`);
    if (typeof m.retrievedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.retrievedAt)) bad(`${id}: retrievedAt required (YYYY-MM-DD)`);
    if (!Array.isArray(m.rates) || !m.rates.length) { bad(`${id}: rates required`); continue; }
    for (const r of m.rates) {
      for (const k of RATE_KEYS) {
        if (r[k] !== undefined && !(typeof r[k] === "number" && r[k] >= 0)) bad(`${id}: rate ${k} must be a number >= 0`);
      }
      if (typeof r.input !== "number" && typeof r.output !== "number") bad(`${id}: rate needs input or output`);
      for (const k of ["from", "until"]) if (r[k] !== undefined && Number.isNaN(Date.parse(r[k]))) bad(`${id}: invalid ${k}`);
    }
  }
  return errors;
}

function loadTable(file = DEFAULT_FILE) {
  if (cache.has(file)) return cache.get(file);
  const table = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validateTable(table);
  if (errors.length) throw new Error(`invalid price table ${file}: ${errors.join("; ")}`);
  const index = new Map();
  for (const m of table.models) index.set(`${m.provider}/${m.id.toLowerCase()}`, m);
  const loaded = { table, index };
  cache.set(file, loaded);
  return loaded;
}

module.exports = { loadTable, validateTable, DEFAULT_FILE, RATE_KEYS };
