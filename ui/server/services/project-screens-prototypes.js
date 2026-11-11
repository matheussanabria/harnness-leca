// @ts-check
// Liga telas do Mapa em Camadas a telas de um protótipo, por doc/sistema/features/_prototipos.json:
// { "prototipo": "dis-paciente", "telas": { "<id da tela do mapa>": "<tela do protótipo>" } }
const fs = require("fs");
const path = require("path");

const ID_RE = /^[a-z0-9_-]{1,80}$/i;

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
  return screens.map((screen) => {
    const target = links[screen.id];
    return typeof target === "string" && ID_RE.test(target) ? { ...screen, prototype: { id: protoId, screen: target } } : screen;
  });
}

module.exports = { attachPrototypes };
