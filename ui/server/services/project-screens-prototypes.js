// @ts-check
// Liga telas do Mapa em Camadas a telas de um protótipo, por doc/sistema/features/_prototipos.json:
// { "prototipo": "dis-paciente", "telas": { "<id da tela do mapa>": "<tela do protótipo>" } }
const fs = require("fs");
const path = require("path");

const ID_RE = /^[a-z0-9_-]{1,80}$/i;
const MAX_SELECTOR = 200;

/**
 * Acrescenta `prototype: { id, screen }` as telas ligadas. Telas sem ligacao ficam como estao.
 * @param {any[]} screens
 * @param {string} repoRoot
 * @returns {any[]}
 */
function attachPrototypes(screens, repoRoot) {
  let map;
  try {
    map = JSON.parse(fs.readFileSync(path.join(repoRoot, "doc", "sistema", "features", "_prototipos.json"), "utf8"));
  } catch {
    return screens;
  }
  const protoId = typeof map?.prototipo === "string" ? map.prototipo : "";
  const links = map && typeof map.telas === "object" && map.telas ? map.telas : {};
  if (!ID_RE.test(protoId)) return screens;
  const selectors = map && typeof map.seletores === "object" && map.seletores ? map.seletores : {};
  return screens.map((screen) => {
    const target = links[screen.id];
    if (typeof target !== "string" || !ID_RE.test(target)) return screen;
    return { ...screen, prototype: { id: protoId, screen: target, selectors: cleanSelectors(selectors[screen.id]) } };
  });
}

/**
 * Seletores CSS por id de campo do mapa. Fica so o que e texto curto; a validade do CSS e conferida pelo navegador.
 * @param {any} raw
 * @returns {Record<string, string>}
 */
function cleanSelectors(raw) {
  /** @type {Record<string, string>} */
  const clean = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [field, selector] of Object.entries(raw)) {
    if (typeof selector === "string" && selector.trim() && selector.length <= MAX_SELECTOR) clean[field] = selector.trim();
  }
  return clean;
}

module.exports = { attachPrototypes };
