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
      const derived = readDerived(dir);
      for (const tela of Array.isArray(data.telas) ? data.telas : []) {
        screens.push(adaptFeatureScreen(applyDerived(tela, derived), { slug: entry.name, featureTitle: title }));
      }
    } catch {
      // funcionalidade sem mapa ou JSON invalido: nao entra
    }
  }
  return screens;
}

/**
 * Aplica o status derivado pelo gate G12 (status-derivado.json, gerado por `fidelidade --derivar`):
 * onde o gate tem evidencia, ele vence o status digitado no mapa.
 * @param {any} tela
 * @param {any} derived  { <telaId>: { <campoId>: "implementado"|"diverge" } }
 */
function applyDerived(tela, derived) {
  const byField = derived?.[tela?.id];
  if (!byField || !Array.isArray(tela.campos)) return tela;
  const campos = tela.campos.map((c) => (byField[c.id] ? { ...c, ui: { ...c.ui, st: byField[c.id] } } : c));
  return { ...tela, campos };
}

function readDerived(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "status-derivado.json"), "utf8")).telas || null;
  } catch {
    return null;
  }
}

/** @param {string} title */
function titleKey(title) {
  return String(title || "").trim().toLowerCase();
}

/**
 * Junta as telas do canvas com as das funcionalidades. O mapa-camadas.json e a fonte viva: quando uma
 * tela do canvas tem a mesma rota e o mesmo titulo de uma tela de funcionalidade, a da funcionalidade
 * substitui o conteudo (o id e a posicao do canvas ficam). As demais telas de funcionalidade entram
 * sem repetir rota.
 * @param {any[]} base telas do canvas
 * @param {any[]} extra telas das funcionalidades
 */
function mergeScreens(base, extra) {
  const used = new Set();
  const merged = base.map((canvas) => {
    const live = extra.find(
      (f) => !used.has(f) && routeKey(f.route) === routeKey(canvas.route) && titleKey(f.title) === titleKey(canvas.title),
    );
    if (!live) return canvas;
    used.add(live);
    return { ...canvas, ...live, id: canvas.id };
  });
  const seen = new Set(base.map((s) => routeKey(s.route)).filter(Boolean));
  for (const screen of extra) {
    if (used.has(screen)) continue;
    const key = routeKey(screen.route);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(screen);
  }
  return merged;
}

module.exports = { readFeatureScreens, mergeScreens, routeKey };
