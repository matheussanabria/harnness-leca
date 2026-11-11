// @ts-check
// Loads the playbook data (docs/playbook/*.json and examples/) and checks it against itself and, when given, DAI.
const fs = require("fs");
const path = require("path");

const SECTIONS = ["ui", "layers", "blocks", "phases", "stages", "gates", "boilerplate", "principles", "example", "gaps", "reference"];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));

/** Every {pt, en} object must have both languages filled; no emoji anywhere (project rule). */
function walk(node, where, issues) {
  if (typeof node === "string") {
    if (EMOJI.test(node)) issues.push(`${where}: emoji is not allowed`);
    return;
  }
  if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${where}[${i}]`, issues)); return; }
  if (!node || typeof node !== "object") return;
  const keys = Object.keys(node);
  if (keys.includes("pt") || keys.includes("en")) {
    for (const lang of ["pt", "en"]) {
      if (typeof node[lang] !== "string" || !node[lang].trim()) issues.push(`${where}: missing "${lang}" text`);
    }
  }
  for (const k of keys) walk(node[k], `${where}.${k}`, issues);
}

/**
 * @param {string} dir  docs/playbook
 * @returns {{ data: Record<string, any>, issues: string[] }}
 */
function loadPlaybook(dir) {
  const issues = [];
  const data = {};
  for (const name of SECTIONS) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) { issues.push(`${name}.json is missing`); continue; }
    try { data[name] = readJson(file); } catch (e) { issues.push(`${name}.json is not valid JSON: ${e.message}`); }
  }
  data.examples = [];
  const exDir = path.join(dir, "examples");
  const map = fs.existsSync(path.join(exDir, "map.json")) ? readJson(path.join(exDir, "map.json")) : {};
  for (const stage of (data.stages && data.stages.items) || []) {
    const file = map[stage.id];
    const full = file && path.join(exDir, file);
    if (!file) { issues.push(`stage "${stage.id}" has no example in examples/map.json`); continue; }
    if (!fs.existsSync(full)) { issues.push(`example ${file} (stage "${stage.id}") is missing`); continue; }
    const body = fs.readFileSync(full, "utf8").replace(/^﻿/, "").trimEnd();
    if (EMOJI.test(body)) issues.push(`example ${file}: emoji is not allowed`);
    data.examples.push({ id: stage.id, name: stage.name, file, body });
  }
  walk(Object.fromEntries(Object.entries(data).filter(([k]) => k !== "examples")), "data", issues);
  return { data, issues };
}

/** Compares the stage list and phases in the data with what DAI declares. */
function compareWithDai(data, dai) {
  const issues = [];
  const mine = (data.stages && data.stages.items) || [];
  const theirs = dai.stages;
  const a = mine.map((s) => s.id).join(">");
  const b = theirs.map((s) => s.id).join(">");
  if (a !== b) issues.push(`stage order differs from DAI: playbook ${a} / DAI ${b}`);
  for (const s of theirs) {
    const own = mine.find((m) => m.id === s.id);
    if (own && s.phase && own.phase !== s.phase) issues.push(`stage "${s.id}": phase "${own.phase}" differs from DAI "${s.phase}"`);
    if (own && Boolean(own.trigger) !== s.trigger) issues.push(`stage "${s.id}": trigger flag differs from DAI`);
  }
  for (const agent of dai.missingAgents || []) issues.push(`DAI stage names agent "${agent}" but .agents/${agent}/ does not exist`);
  return issues;
}

module.exports = { loadPlaybook, compareWithDai, SECTIONS };
