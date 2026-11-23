// @ts-check
// Sessions the sync found but could not assign to a project ("sem projeto"). The sync is the authority: each run
// replaces the entries of the engines it scanned. Associating one adds an alias to projects/.sources.json, which
// tools/lib/projects.js already reads, so the next sync imports those conversations into the chosen project.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./root");
const { existingSlugs } = require("./projects");

const file = () => path.join(ROOT, "projects", ".unmatched.json");
const sourcesFile = () => path.join(ROOT, "projects", ".sources.json");
const MAX_NAME = 200;

/** @typedef {{ engine: string, name: string, seenAt: string }} Unmatched */

const readJson = (f) => {
  try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, "")); } catch { return null; }
};

/** @returns {Unmatched[]} */
function list() {
  const data = readJson(file());
  return Array.isArray(data && data.items) ? data.items.filter((i) => i && typeof i.engine === "string" && typeof i.name === "string") : [];
}

/**
 * Replaces the entries of the scanned engines and keeps the others.
 * @param {Record<string, string[]>} byEngine engine -> names found without a project (an empty array clears the engine)
 */
function record(byEngine, now = new Date()) {
  const scanned = new Set(Object.keys(byEngine));
  const kept = list().filter((i) => !scanned.has(i.engine));
  const fresh = Object.entries(byEngine).flatMap(([engine, names]) =>
    [...new Set(names)].sort().map((name) => ({ engine, name: String(name).slice(0, MAX_NAME), seenAt: now.toISOString() })));
  fs.writeFileSync(file(), `${JSON.stringify({ updatedAt: now.toISOString(), items: [...kept, ...fresh] }, null, 2)}\n`, "utf8");
}

/**
 * Associates an entry with a project through an alias. Only names the sync itself recorded are accepted.
 * @returns {{ ok: true, alias: string } | { ok: false, status: number, error: string }}
 */
function associate({ engine, name, slug }) {
  if (!existingSlugs().includes(slug)) return { ok: false, status: 404, error: "projeto não encontrado" };
  const items = list();
  const hit = items.find((i) => i.engine === engine && i.name === name);
  if (!hit) return { ok: false, status: 404, error: "sessão sem projeto não encontrada (rode o sync de novo)" };

  const aliases = readJson(sourcesFile()) || {};
  const current = Array.isArray(aliases[slug]) ? aliases[slug].filter((x) => typeof x === "string") : [];
  if (!current.some((a) => a.toLowerCase() === name.toLowerCase())) current.push(name);
  aliases[slug] = current;
  fs.writeFileSync(sourcesFile(), `${JSON.stringify(aliases, null, 2)}\n`, "utf8");

  fs.writeFileSync(file(), `${JSON.stringify({ updatedAt: new Date().toISOString(), items: items.filter((i) => i !== hit) }, null, 2)}\n`, "utf8");
  return { ok: true, alias: name };
}

module.exports = { list, record, associate };
