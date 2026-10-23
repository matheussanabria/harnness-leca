// @ts-check
// Fachada de design-audit: reexporta a API pública e adota o estado persistido
// da tela (EP-14.09): filtros, severidade, estado de evidência e componente.
import { $ } from "../shared/dom.js";
import { getScreenStateClient } from "../shared/screen-state.js";
import { das } from "./design-audit-store.js";
import { renderAuditWorkspace as renderAuditBase } from "./design-audit-workspace.js";

export const AUDIT_SCREEN_ID = "audit";
const SEVERITIES = Object.freeze(["all", "uncovered", "covered"]);
const EVIDENCE_STATES = Object.freeze(["all", "planned", "generated", "executed", "approved"]);

const text = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");

/** Fotografia serializável do estado atual da Auditoria. */
export function auditStateFromStore() {
  return {
    matrixFilter: text(das.auditSearchQuery, 120),
    severity: SEVERITIES.includes(das.auditFilterMode) ? das.auditFilterMode : "all",
    evidenceState: EVIDENCE_STATES.includes(das.auditEvidenceState) ? das.auditEvidenceState : "all",
    selectedComponent: text(das.selectedComponent, 120),
  };
}

/** Aplica somente campos válidos e devolve `true` quando o store mudou. */
export function applyAuditState(state = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  let changed = false;
  const set = (key, value) => {
    if (das[key] === value) return;
    das[key] = value;
    changed = true;
  };

  if (typeof state.matrixFilter === "string") set("auditSearchQuery", text(state.matrixFilter, 120));
  if (typeof state.severity === "string" && SEVERITIES.includes(state.severity)) set("auditFilterMode", state.severity);
  if (typeof state.evidenceState === "string" && EVIDENCE_STATES.includes(state.evidenceState)) set("auditEvidenceState", state.evidenceState);
  if (typeof state.selectedComponent === "string") set("selectedComponent", text(state.selectedComponent, 120));
  return changed;
}

let hydrated = false;
let hydration = null;
let pending = null;

async function hydrate() {
  if (hydrated) return false;
  if (hydration) return hydration;
  const client = getScreenStateClient();
  hydration = Promise.resolve()
    .then(() => client.loadScreen(AUDIT_SCREEN_ID))
    .catch(() => ({}))
    .then((loaded) => {
      let changed = applyAuditState(loaded);
      if (pending) changed = applyAuditState(pending) || changed;
      hydrated = true;
      hydration = null;
      return changed;
    });
  return hydration;
}

async function persist(patch) {
  const safe = patch && typeof patch === "object" ? patch : auditStateFromStore();
  applyAuditState(safe);
  pending = { ...(pending || {}), ...safe };
  await hydrate();
  const payload = auditStateFromStore();
  pending = null;
  try { return await getScreenStateClient().patchScreen(AUDIT_SCREEN_ID, payload); } catch { return false; }
}

function log(acao, alvo = "") {
  try { return getScreenStateClient().logAction(AUDIT_SCREEN_ID, acao, String(alvo).slice(0, 300)); } catch { return false; }
}

function rerender() {
  const container = $("designViewContainer");
  if (container && das.currentAuditData) renderAuditWorkspace(container, "", das.currentAuditData);
}

/** Registra no container a seleção de componente e as ações de evidência. */
function bindContainer(container) {
  if (container.dataset.auditBound === "1") return;
  container.dataset.auditBound = "1";
  container.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof Element ? event.target : null);
    const card = target?.closest?.(".audit-component-card");
    if (card) {
      const id = card.getAttribute("data-component-id") || "";
      das.selectedComponent = id;
      void persist({ selectedComponent: id });
      container.querySelectorAll(".audit-component-card.is-selected").forEach((el) => el.classList.remove("is-selected"));
      card.classList.add("is-selected");
    }
    const action = target?.closest?.("[data-evidence-action]");
    if (action) {
      const name = action.getAttribute("data-evidence-action") || "";
      const rule = action.getAttribute("data-rule-title") || "";
      const screen = action.getAttribute("data-screen-id") || "";
      void log("execucao-de-auditoria", `${name}:${screen}/${rule}`);
    }
    const filter = target?.closest?.("[data-evidence-filter]");
    if (filter) void persist({ evidenceState: das.auditEvidenceState });
  });
}

/**
 * Renderiza o painel de auditoria e hidrata os filtros persistidos.
 * @param {HTMLElement} container
 * @param {string} projectSlug
 * @param {any} auditData
 */
export function renderAuditWorkspace(container, projectSlug, auditData) {
  renderAuditBase(container, projectSlug, auditData);
  if (!auditData) return;
  if (container instanceof HTMLElement) bindContainer(container);
  if (hydrated) return;
  hydrate().then((changed) => {
    if (changed) renderAuditWorkspace(container, projectSlug, auditData);
  });
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.onAuditSearchInput = (val) => {
    das.auditSearchQuery = val;
    void persist({ matrixFilter: val });
    rerender();
  };
  // @ts-ignore
  window.setAuditRulesFilter = (mode) => {
    das.auditFilterMode = mode;
    void persist({ severity: mode });
    rerender();
  };
}
