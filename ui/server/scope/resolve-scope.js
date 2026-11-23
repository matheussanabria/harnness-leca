// @ts-check
// Explicit request scope (EP-25.02, ADR-019): { projectSlug | null } instead of the implicit projects/.active.
const { slugs, active } = require("../config");
const { PERSONAL_SLUG } = require("./reserved");
const { ensurePersonalWorkspace, isPersonal } = require("./personal-workspace");

const HEADER = "x-harness-project";
const NONE_VALUES = new Set(["", "none", PERSONAL_SLUG]);

/**
 * @typedef {{ ok: true, projectSlug: string|null, workspace: string, personal: boolean, source: "header"|"default" }
 *   | { ok: false, error: string }} Scope
 */

/**
 * Header present: "none" or "_pessoal" mean no project; a known slug selects it; anything else is an error.
 * Header absent: the last used project (.active) when fallbackActive is true, otherwise no project.
 * @param {{ headers?: Record<string, any> }} req
 * @param {{ fallbackActive?: boolean }} [options]
 * @returns {Scope}
 */
function resolveScope(req, { fallbackActive = true } = {}) {
  const raw = req && req.headers ? req.headers[HEADER] : undefined;
  if (raw === undefined) {
    const last = fallbackActive ? active() || null : null;
    return build(last, "default");
  }
  const value = String(raw).trim().toLowerCase();
  if (NONE_VALUES.has(value)) return build(null, "header");
  const known = slugs().find((s) => s.toLowerCase() === value);
  return known ? build(known, "header") : { ok: false, error: "projeto não encontrado" };
}

/** @returns {Scope} */
function build(projectSlug, source) {
  return { ok: true, projectSlug, workspace: projectSlug || PERSONAL_SLUG, personal: !projectSlug, source };
}

/**
 * Validator for features that accept the personal workspace (chat). A real project must exist;
 * the personal slug is accepted and its folder is created on first use.
 * @param {unknown} slug
 */
function acceptsScope(slug) {
  if (typeof slug !== "string") return false;
  if (isPersonal(slug)) {
    ensurePersonalWorkspace();
    return true;
  }
  return slugs().includes(slug);
}

module.exports = { HEADER, resolveScope, acceptsScope };
