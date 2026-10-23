// @ts-check
"use strict";
/**
 * Sincroniza as pastas do DS (`design/ds/components/<slug>/manifest.json`) com o registro (`registry.json`),
 * que é o que o quadro de componentes lê. Primeiro calcula o plano (sem gravar); depois aplica, se pedido.
 *
 *   added    pasta nova, ainda fora do registro
 *   changed  manifest ou arquivos mudaram desde a última sincronização (impressão digital diferente)
 *   missing  está no registro, mas a pasta sumiu (só é removido com prune)
 *   invalid  manifest fora do namespace do projeto ou sem nome
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadRegistry, registerComponent, saveRegistry } = require("../../ui/server/services/design-registry.service");
const { loadDsConfig } = require("./ds-config");

/** Pastas de componentes que têm manifest.json. */
function scanComponents(dsDir) {
  const compDir = path.join(dsDir, "components");
  if (!fs.existsSync(compDir)) return [];
  return fs.readdirSync(compDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(compDir, e.name, "manifest.json")))
    .map((e) => {
      const dir = path.join(compDir, e.name);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
      return { slug: e.name, dir, manifest };
    });
}

/** Impressão digital: manifest mais os arquivos listados nas implementações (ordem estável). */
function fingerprint(dir, manifest) {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(manifest));
  const files = new Set();
  for (const impl of Object.values(manifest.implementations || {})) {
    for (const file of impl?.files || []) files.add(file);
  }
  for (const file of [...files].sort()) {
    const abs = path.join(dir, file);
    if (fs.existsSync(abs)) hash.update(file).update(fs.readFileSync(abs));
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * Compara as pastas do DS com o registro. Não grava nada.
 * @param {string} projectDir  pasta do projeto (projects/<slug>)
 */
function planSync(projectDir) {
  const config = loadDsConfig(projectDir);
  const registry = loadRegistry(projectDir);
  const plan = { namespace: config.namespace, added: [], changed: [], unchanged: [], missing: [], invalid: [], entries: new Map() };
  const seen = new Set();

  for (const { slug, dir, manifest } of scanComponents(path.join(projectDir, "design", "ds"))) {
    const id = String(manifest.id || "");
    const problems = [];
    if (!id.startsWith(`${config.namespace}.`)) problems.push(`id deve começar com "${config.namespace}." (está "${id}").`);
    if (!manifest.name) problems.push('falta "name".');
    if (problems.length) { plan.invalid.push({ id: id || slug, problems }); continue; }

    seen.add(id);
    const hash = fingerprint(dir, manifest);
    const current = registry.components[id];
    if (!current) plan.added.push(id);
    else if (current.sourceHash !== hash) plan.changed.push(id);
    else plan.unchanged.push(id);
    plan.entries.set(id, { slug, dir, manifest, hash });
  }
  plan.missing = Object.keys(registry.components).filter((id) => !seen.has(id));
  return plan;
}

/**
 * Aplica o plano: registra os novos e os alterados; com prune, tira do registro os que sumiram da pasta.
 * @param {string} projectDir
 * @param {ReturnType<typeof planSync>} plan
 * @param {{ prune?: boolean }} [options]
 */
function applySync(projectDir, plan, options = {}) {
  const result = { registered: [], removed: [], errors: [] };
  for (const id of [...plan.added, ...plan.changed]) {
    const entry = plan.entries.get(id);
    if (!entry) continue;
    try {
      registerComponent(projectDir, entry.manifest);
    } catch (err) {
      result.errors.push({ id, error: err instanceof Error ? err.message : String(err) });
      continue;
    }
    // A impressão digital fica no registro: a próxima execução acha só o que mudou de verdade.
    const registry = loadRegistry(projectDir);
    if (registry.components[id]) {
      registry.components[id].sourceHash = entry.hash;
      saveRegistry(projectDir, registry);
    }
    result.registered.push(id);
  }
  if (options.prune && plan.missing.length) {
    const registry = loadRegistry(projectDir);
    for (const id of plan.missing) {
      delete registry.components[id];
      result.removed.push(id);
    }
    saveRegistry(projectDir, registry);
  }
  return result;
}

module.exports = { planSync, applySync, scanComponents, fingerprint };
