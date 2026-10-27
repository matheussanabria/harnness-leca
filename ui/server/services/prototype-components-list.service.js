// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { loadRegistry } = require("./design-registry.service");

/** Qualquer abertura de tag, para ler os atributos sem depender de DOM no servidor. */
const TAG_RE = /<[a-zA-Z][\w-]*\b[^>]*>/g;

/** Valor de um atributo dentro do texto de uma tag. */
function attrOf(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/**
 * Instâncias de componentes do DS numa tela, pelo atributo `data-component` (com o `data-pid` do elemento).
 * @param {string} html
 * @returns {{ componentId: string, pid: string }[]}
 */
function scanScreenInstances(html) {
  const out = [];
  for (const tag of html.match(TAG_RE) || []) {
    const componentId = attrOf(tag, "data-component");
    if (componentId) out.push({ componentId, pid: attrOf(tag, "data-pid") || "" });
  }
  return out;
}

/**
 * Lista os componentes do DS que o protótipo usa, agrupados por componente e por tela.
 * Só protótipos modulares (telas em arquivos HTML) têm instâncias listadas.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ fs: typeof fs, path: typeof path }} [deps]
 */
function listPrototypeComponents(projectDir, protoId, deps = { fs, path }) {
  const protoDir = deps.path.join(getPrototypesBaseDir(projectDir, deps), protoId);
  const protoFile = deps.path.join(protoDir, "proto.json");
  if (!deps.fs.existsSync(protoFile)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }
  const proto = JSON.parse(deps.fs.readFileSync(protoFile, "utf8"));
  const screens = Array.isArray(proto.screens) ? proto.screens : [];
  const registry = loadRegistry(projectDir, deps);
  const byId = new Map();

  // Imported artifacts can declare source/reference components even when their runtime markup is
  // generated dynamically and therefore has no stable DOM instance to annotate.
  for (const declared of Array.isArray(proto.components) ? proto.components : []) {
    if (!declared?.id) continue;
    const meta = registry.components[declared.id] || {};
    const entry = {
      id: declared.id, name: declared.name || meta.name || declared.id,
      category: meta.category || "", relationship: declared.relationship || "declared",
      instances: 0, screens: [],
    };
    if (declared.screen) {
      const screen = screens.find((candidate) => candidate.id === declared.screen);
      entry.screens.push({ screenId: declared.screen, title: screen?.title || declared.screen, count: declared.pid ? 1 : 0, pids: declared.pid ? [declared.pid] : [] });
      if (declared.pid) entry.instances = 1;
    }
    byId.set(declared.id, entry);
  }

  for (const screen of screens) {
    const file = deps.path.join(protoDir, screen.file || screen.htmlFile || `screens/${screen.id}.html`);
    if (!deps.fs.existsSync(file)) continue;
    const html = deps.fs.readFileSync(file, "utf8");
    for (const inst of scanScreenInstances(html)) {
      let entry = byId.get(inst.componentId);
      if (!entry) {
        const meta = registry.components[inst.componentId] || {};
        entry = { id: inst.componentId, name: meta.name || inst.componentId, category: meta.category || "", instances: 0, screens: [] };
        byId.set(inst.componentId, entry);
      }
      let where = entry.screens.find((s) => s.screenId === screen.id);
      if (!where) {
        where = { screenId: screen.id, title: screen.title || screen.id, count: 0, pids: [] };
        entry.screens.push(where);
      }
      where.count += 1;
      entry.instances += 1;
      if (inst.pid) where.pids.push(inst.pid);
    }
  }

  const components = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { protoId, components };
}

/**
 * Uso de cada componente em todos os protótipos do projeto, pela chave sem namespace ("text-field").
 * @param {string} projectDir
 * @param {{ fs: typeof fs, path: typeof path }} [deps]
 * @returns {Map<string, { prototypes: number, screens: number }>}
 */
function countComponentUsage(projectDir, deps = { fs, path }) {
  const out = new Map();
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  if (!deps.fs.existsSync(baseDir)) return out;
  for (const ent of deps.fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    let listing;
    try { listing = listPrototypeComponents(projectDir, ent.name, deps); } catch { continue; }
    for (const comp of listing.components) {
      const key = comp.id.includes(".") ? comp.id.slice(comp.id.indexOf(".") + 1) : comp.id;
      const cur = out.get(key) || { prototypes: 0, screens: 0 };
      cur.prototypes += 1;
      cur.screens += comp.screens.length;
      out.set(key, cur);
    }
  }
  return out;
}

module.exports = { listPrototypeComponents, scanScreenInstances, countComponentUsage };
