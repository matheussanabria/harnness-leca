// @ts-check
// Links between screens of the Layers map, from the `navega` each screen declares (feature-screen-adapter).
// Runs after mergeScreens: a target written "<slug>-<tela>" may now live under a canvas id (s2), so targets
// resolve by id and by featureScreenId. The opposite direction is computed, never written:
//   navegacao: vaiPara on the source, vemDe on the target
//   chamada:   chama on the source,  chamadaPor on the target
// The `campo` of an item is always a field of the SOURCE screen.

/**
 * @typedef {{ id: string | null, para?: string, title: string, campo: string, via: string, como: string, evidencia: string, broken?: boolean }} ScreenLink
 * @typedef {{ vaiPara: ScreenLink[], vemDe: ScreenLink[], chama: ScreenLink[], chamadaPor: ScreenLink[] }} ScreenLinks
 */

/** @param {any} s */
const titleOf = (s) => String(s?.short || s?.title || s?.id || "");

/** @returns {ScreenLinks} */
const emptyLinks = () => ({ vaiPara: [], vemDe: [], chama: [], chamadaPor: [] });

/**
 * @param {any[]} screens final screens of the map
 * @returns {any[]} the same screens, each with `links`
 */
function linkScreens(screens) {
  const list = Array.isArray(screens) ? screens : [];
  /** @type {Map<string, any>} */
  const byId = new Map();
  for (const s of list) {
    s.links = emptyLinks();
    if (s.featureScreenId) byId.set(String(s.featureScreenId), s);
  }
  for (const s of list) byId.set(String(s.id), s); // a real id wins over an alias with the same text

  for (const src of list) {
    for (const item of Array.isArray(src.navega) ? src.navega : []) {
      const out = item.tipo === "chamada" ? "chama" : "vaiPara";
      const back = item.tipo === "chamada" ? "chamadaPor" : "vemDe";
      const base = { campo: item.campo || "", via: item.via || "", como: item.como || "", evidencia: item.evidencia || "" };
      const dst = byId.get(String(item.para));
      if (!dst) {
        src.links[out].push({ ...base, id: null, para: String(item.para), title: String(item.para), broken: true });
        continue;
      }
      src.links[out].push({ ...base, id: String(dst.id), title: titleOf(dst) });
      dst.links[back].push({ ...base, id: String(src.id), title: titleOf(src) });
    }
  }
  return list;
}

module.exports = { linkScreens };
