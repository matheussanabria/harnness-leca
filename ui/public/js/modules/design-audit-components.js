// @ts-check
// Secao "Quadro de Componentes" da aba Auditoria (EP-11.03).
import { esc } from "../shared/dom.js";

const SITUATION_META = {
  sem_regra: { label: "Sem regra", icon: "fa-circle-question", className: "is-empty" },
  regra_sem_evidencia: { label: "Regra sem evidencia", icon: "fa-circle-exclamation", className: "is-warning" },
  regra_em_execucao: { label: "Regra em execucao", icon: "fa-spinner", className: "is-running" },
  regra_aprovada: { label: "Regra aprovada", icon: "fa-circle-check", className: "is-approved" },
};

const STAGE_LABEL = {
  prototype: "Prototipo",
  extracted: "Extraido",
  design_system: "Design System",
  boilerplate: "Boilerplate",
  implemented: "Implementado",
  documented: "Documentado",
};

/**
 * Carrega o cruzamento entre componentes e auditoria.
 * @param {string} slug
 */
export async function fetchComponentAudit(slug) {
  const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/components`);
  if (!res.ok) {
    let error = "Falha ao carregar o quadro de componentes.";
    try {
      error = (await res.json()).error || error;
    } catch {
      /* resposta sem json */
    }
    return { ok: false, error };
  }
  return await res.json();
}

function situationBadge(situation) {
  const meta = SITUATION_META[situation] || SITUATION_META.sem_regra;
  return `<span class="audit-component-situation ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function checklistMarks(checklist = {}) {
  const marks = [
    ["inPrototype", "fa-pen-ruler", "Prototipo"],
    ["isExtracted", "fa-scissors", "Extraido"],
    ["inDesignSystem", "fa-shapes", "Design System"],
    ["hasBoilerplate", "fa-boxes-stacked", "Boilerplate"],
    ["isImplemented", "fa-code", "Implementado"],
    ["isDocumented", "fa-book", "Documentado"],
  ];
  return marks.map(([key, icon, label]) => {
    const done = Boolean(checklist[key]);
    return `<span class="audit-component-mark ${done ? "is-done" : ""}" title="${esc(label)}"><i class="fa-solid ${icon}"></i></span>`;
  }).join("");
}

function renderComponent(component) {
  const rules = component.audit?.rules || [];
  const ruleList = rules.length
    ? rules.map((rule) => `<li><span class="audit-component-rule-state is-${esc(rule.state)}">${esc(rule.state)}</span> ${esc(rule.ruleTitle)}</li>`).join("")
    : `<li class="audit-component-no-rule">Nenhuma regra de negocio vinculada</li>`;
  return `<article class="audit-component-card" data-component-id="${esc(component.id)}">
    <header class="audit-component-head">
      <h4><i class="fa-solid fa-cubes"></i> ${esc(component.name || component.id)}</h4>
      ${situationBadge(component.situation)}
    </header>
    <div class="audit-component-meta">
      <span><i class="fa-solid fa-flag"></i> ${esc(STAGE_LABEL[component.stage] || component.stage)}</span>
      <span class="audit-component-marks">${checklistMarks(component.checklist)}</span>
    </div>
    <ul class="audit-component-rules">${ruleList}</ul>
  </article>`;
}

/**
 * Renderiza a secao do Quadro de Componentes dentro da aba Auditoria.
 * @param {HTMLElement} container
 * @param {string} slug
 */
export async function renderComponentSection(container, slug) {
  const host = /** @type {HTMLElement | null} */ (container.querySelector("#auditComponentsBody"));
  if (!host) return;
  host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando componentes...</div>`;

  const data = await fetchComponentAudit(slug);
  if (!data.ok) {
    host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error)}</div>`;
    return;
  }

  const components = data.components || [];
  const orphans = data.rulesWithoutComponent || [];
  host.innerHTML = `
    <div class="audit-evidence-summary">
      <span><i class="fa-solid fa-cubes"></i> ${data.totals?.components || 0} componente(s)</span>
      <span><i class="fa-solid fa-link"></i> ${data.totals?.withRules || 0} com regra vinculada</span>
      <span><i class="fa-solid fa-circle-check"></i> ${data.totals?.approved || 0} com regra aprovada</span>
      <span><i class="fa-solid fa-unlink"></i> ${orphans.length} regra(s) sem componente</span>
    </div>
    ${components.length ? `<div class="audit-component-grid">${components.map(renderComponent).join("")}</div>`
      : `<p class="routine-empty-line">Nenhum componente identificado no Design Index deste projeto.</p>`}
    ${orphans.length ? `<details class="audit-orphan-rules">
      <summary><i class="fa-solid fa-unlink"></i> Regras sem componente vinculado (${orphans.length})</summary>
      <ul>${orphans.map((rule) => `<li>${esc(rule.ruleTitle)} <span class="audit-component-rule-state is-${esc(rule.state)}">${esc(rule.state)}</span></li>`).join("")}</ul>
    </details>` : ""}`;
}
