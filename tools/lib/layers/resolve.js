// @ts-check
// Effective set of skills, agents and workflows for a project, from three layers (the most specific wins by id):
//   dai      the personal DAI repository (read only)           skills/, .agents/, workflows/
//   global   global/ of the harness, shared by all projects    global/{skills,agents,workflows}/
//   project  projects/<slug>/ (+ the workspace .agents/skills) {skills,agents,workflows}/
// projects/<slug>/project.json may switch off inherited items:
//   { "layers": { "disable": { "skills": ["checkstyle"], "workflows": ["sprint-cycle"] } } }
// A project's own items cannot be disabled (delete them instead); an item shadowed by a more specific layer is
// reported in `overrides`.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { cleanBOM } = require("../skills/frontmatter");
const { readWorkspace } = require("../skills/targets");
const { KINDS, scanKind } = require("./scan");

const LAYERS = ["dai", "global", "project"];
const PLURAL = { skill: "skills", agent: "agents", workflow: "workflows" };

/** Where each layer keeps each kind. @returns {Record<string, Record<string, string[]>>} */
function roots(slug, daiPath) {
  const projectDir = path.join(ROOT, "projects", slug);
  const workspace = readWorkspace(projectDir);
  return {
    dai: daiPath ? { skill: [path.join(daiPath, "skills")], agent: [path.join(daiPath, ".agents")], workflow: [path.join(daiPath, "workflows")] } : { skill: [], agent: [], workflow: [] },
    global: Object.fromEntries(KINDS.map((k) => [k, [path.join(ROOT, "global", PLURAL[k])]])),
    project: {
      skill: [path.join(projectDir, "skills"), path.join(projectDir, ".agents", "skills"), ...(workspace ? [path.join(workspace, ".agents", "skills")] : [])],
      agent: [path.join(projectDir, "agents")],
      workflow: [path.join(projectDir, "workflows")],
    },
  };
}

/** @param {string} slug @returns {Record<string, string[]>} kind plural -> disabled ids */
function readDisabled(slug) {
  try {
    const cfg = JSON.parse(cleanBOM(fs.readFileSync(path.join(ROOT, "projects", slug, "project.json"), "utf8")));
    const d = (cfg && cfg.layers && cfg.layers.disable) || {};
    return Object.fromEntries(KINDS.map((k) => [PLURAL[k], Array.isArray(d[PLURAL[k]]) ? d[PLURAL[k]].filter((x) => typeof x === "string") : []]));
  } catch {
    return { skills: [], agents: [], workflows: [] };
  }
}

/**
 * @param {string} slug
 * @param {{ daiPath?: string|null }} [o] daiPath: DAI root; null or missing skips that layer
 * @returns {{ items: { id: string, kind: string, layer: string, file: string, description: string, overrides: string[] }[], disabled: { id: string, kind: string, layer: string }[] }}
 */
function resolveLayers(slug, o = {}) {
  const r = roots(slug, o.daiPath || null);
  const off = readDisabled(slug);
  /** @type {Map<string, any>} */
  const winners = new Map();
  const disabled = [];
  for (const kind of KINDS) {
    for (const layer of LAYERS) {
      for (const root of r[layer][kind]) {
        for (const it of scanKind(kind, root)) {
          const key = `${kind}:${it.id}`;
          if (layer !== "project" && off[PLURAL[kind]].includes(it.id)) { disabled.push({ id: it.id, kind, layer }); continue; }
          const prev = winners.get(key);
          const overrides = prev ? [...prev.overrides, prev.layer] : [];
          if (prev && prev.layer === layer) continue; // same layer, another root: the first root wins
          winners.set(key, { id: it.id, kind, layer, file: it.file.split(path.sep).join("/"), description: it.description, overrides });
        }
      }
    }
  }
  const items = [...winners.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return { items, disabled };
}

module.exports = { LAYERS, resolveLayers, readDisabled };
