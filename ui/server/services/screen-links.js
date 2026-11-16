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

/** @param {any} route */
const routeKey = (route) => String(route || "").trim().toLowerCase();

/**
 * Feature screens that mergeScreens left out because a canvas screen already owns their route (with another title):
 * their content lives inside that canvas screen (the host). Returns "<slug>-<tela>" -> { host, title }.
 * @param {any[]} list final screens @param {any[]} featureScreens all screens read from mapa-camadas.json
 */
function absorbedScreens(list, featureScreens) {
  const present = new Set(list.map((s) => s.featureScreenId).filter(Boolean));
  /** @type {Map<string, { host: any, title: string, navega: any[] }>} */
  const out = new Map();
  for (const f of featureScreens || []) {
    if (!f.featureScreenId || present.has(f.featureScreenId)) continue;
    const host = list.find((s) => routeKey(s.route) && routeKey(s.route) === routeKey(f.route));
    if (host) out.set(String(f.featureScreenId), { host, title: titleOf(f), navega: Array.isArray(f.navega) ? f.navega : [] });
  }
  return out;
}

/**
 * @param {any[]} screens final screens of the map
 * @param {any[]} [featureScreens] every feature screen before the merge; lets links to and from an absorbed screen
 *   land on the screen that holds it, keeping the absorbed title
 * @returns {any[]} the same screens, each with `links`
 */
function linkScreens(screens, featureScreens = []) {
  const list = Array.isArray(screens) ? screens : [];
  /** @type {Map<string, { screen: any, title: string }>} */
  const byId = new Map();
  for (const s of list) {
    s.links = emptyLinks();
    if (s.featureScreenId) byId.set(String(s.featureScreenId), { screen: s, title: titleOf(s) });
  }
  const absorbed = absorbedScreens(list, featureScreens);
  for (const [id, a] of absorbed) byId.set(id, { screen: a.host, title: a.title });
  for (const s of list) byId.set(String(s.id), { screen: s, title: titleOf(s) }); // a real id wins over an alias

  /** @type {{ screen: any, title: string, navega: any[] }[]} */
  const sources = [
    ...list.map((s) => ({ screen: s, title: titleOf(s), navega: Array.isArray(s.navega) ? s.navega : [] })),
    ...[...absorbed.values()].map((a) => ({ screen: a.host, title: a.title, navega: a.navega })),
  ];
  for (const src of sources) {
    for (const item of src.navega) {
      const out = item.tipo === "chamada" ? "chama" : "vaiPara";
      const back = item.tipo === "chamada" ? "chamadaPor" : "vemDe";
      const base = { campo: item.campo || "", via: item.via || "", como: item.como || "", evidencia: item.evidencia || "" };
      const dst = byId.get(String(item.para));
      if (!dst) {
        src.screen.links[out].push({ ...base, id: null, para: String(item.para), title: String(item.para), broken: true });
        continue;
      }
      src.screen.links[out].push({ ...base, id: String(dst.screen.id), title: dst.title });
      dst.screen.links[back].push({ ...base, id: String(src.screen.id), title: src.title });
    }
  }
  return list;
}

module.exports = { linkScreens, absorbedScreens };
