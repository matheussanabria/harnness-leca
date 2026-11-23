// @ts-check
// Pure validator for the feature manifest (EP-25.01, ADR-019). No I/O.

const SCOPES = Object.freeze(["project", "optional", "global"]);
/** "ativa" opens something today; "planejada" is listed by the launcher as "em breve" until its story ships. */
const STATES = Object.freeze(["ativa", "planejada"]);
const ICON_RE = /^fa-(solid|regular) fa-[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Emoji and pictographs are banned in titles and icons (project rule).
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** @typedef {{id:string,titulo:string,escopo:string,icone:string,rota:string,janela:string,artefatos:string[],descricao?:string,estado?:string}} Feature */

/**
 * @param {unknown} list
 * @returns {string[]} human readable errors; empty when valid
 */
function validateManifest(list) {
  const errors = [];
  if (!Array.isArray(list) || list.length === 0) return ["manifest must be a non-empty array"];
  const ids = new Set();
  const routes = new Set();
  list.forEach((f, i) => {
    const at = `feature[${i}]${f && f.id ? ` (${f.id})` : ""}`;
    if (!f || typeof f !== "object") return errors.push(`${at}: must be an object`);
    if (typeof f.id !== "string" || !ID_RE.test(f.id)) errors.push(`${at}: id must be kebab-case`);
    else if (ids.has(f.id)) errors.push(`${at}: duplicate id`);
    else ids.add(f.id);
    if (typeof f.titulo !== "string" || !f.titulo.trim()) errors.push(`${at}: titulo is required`);
    else if (EMOJI_RE.test(f.titulo)) errors.push(`${at}: titulo must not contain emoji`);
    if (f.descricao !== undefined && (typeof f.descricao !== "string" || EMOJI_RE.test(f.descricao))) {
      errors.push(`${at}: descricao must be text without emoji`);
    }
    if (!SCOPES.includes(f.escopo)) errors.push(`${at}: escopo must be one of ${SCOPES.join(", ")}`);
    if (f.estado !== undefined && !STATES.includes(f.estado)) errors.push(`${at}: estado must be one of ${STATES.join(", ")}`);
    if (typeof f.icone !== "string" || !ICON_RE.test(f.icone)) {
      errors.push(`${at}: icone must be a FontAwesome class like "fa-solid fa-comments"`);
    }
    if (typeof f.rota !== "string" || !f.rota.startsWith("/")) errors.push(`${at}: rota must start with "/"`);
    else if (routes.has(f.rota)) errors.push(`${at}: duplicate rota ${f.rota}`);
    else routes.add(f.rota);
    if (typeof f.janela !== "string" || !f.janela) errors.push(`${at}: janela is required`);
    if (!Array.isArray(f.artefatos) || f.artefatos.some((a) => typeof a !== "string")) {
      errors.push(`${at}: artefatos must be an array of strings`);
    }
  });
  return errors;
}

module.exports = { SCOPES, STATES, validateManifest };
