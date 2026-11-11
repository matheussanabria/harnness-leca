// @ts-check
// Telas das funcionalidades (doc/sistema/features/<slug>/mapa-camadas.json) para o Mapa em Camadas.
const fs = require("fs");
const path = require("path");
const { adaptFeatureScreen } = require("./feature-screen-adapter");

const FEATURES_REL = ["doc", "sistema", "features"];

/** @param {string} route */
function routeKey(route) {
  return String(route || "").trim().toLowerCase();
}

/** @param {string} dir @param {string} slug */
function featureTitle(dir, slug) {
  try {
    const text = fs.readFileSync(path.join(dir, "_status.md"), "utf8");
    const alias = text.match(/aliases:\s*\["([^"]+)"/);
    if (alias) return alias[1].replace(/^Status:\s*/i, "");
  } catch {
    // sem _status.md: usa o slug
  }
  return slug;
}

/**
 * Le as telas de cada funcionalidade que tem mapa-camadas.json.
 * @param {string} repoRoot
 * @returns {any[]} telas no formato do Mapa em Camadas (id "<slug>-<tela>")
 */
function readFeatureScreens(repoRoot) {
  const root = path.join(repoRoot, ...FEATURES_REL);
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
  const screens = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = path.join(root, entry.name);
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, "mapa-camadas.json"), "utf8"));
      const title = featureTitle(dir, entry.name);
      for (const tela of Array.isArray(data.telas) ? data.telas : []) {
        screens.push(adaptFeatureScreen(tela, { slug: entry.name, featureTitle: title }));
      }
    } catch {
      // funcionalidade sem mapa ou JSON invalido: nao entra
    }
  }
  return screens;
}

/**
 * Acrescenta as telas das funcionalidades as telas ja existentes, sem repetir rota.
 * @param {any[]} base telas do canvas
 * @param {any[]} extra telas das funcionalidades
 */
function mergeScreens(base, extra) {
  const seen = new Set(base.map((s) => routeKey(s.route)).filter(Boolean));
  const merged = [...base];
  for (const screen of extra) {
    const key = routeKey(screen.route);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(screen);
  }
  return merged;
}

module.exports = { readFeatureScreens, mergeScreens, routeKey };
