// @ts-check
import { $, esc } from "../shared/dom.js";

/**
 * Retorna o ícone FontAwesome correspondente ao status do passo do plano.
 * @param {"pending" | "in_progress" | "done"} status
 * @returns {string}
 */
export function getStepStatusIcon(status) {
  if (status === "done") {
    return '<i class="fa-solid fa-circle-check text-success"></i>';
  }
  if (status === "in_progress") {
    return '<i class="fa-solid fa-spinner fa-spin text-accent"></i>';
  }
  return '<i class="fa-regular fa-circle text-muted"></i>';
}

/**
 * Renderiza o cartão visual com os passos e suposições do plano do Ateliê.
 * @param {{ steps: Array<{ id: string, title: string, status: "pending" | "in_progress" | "done" }>, assumptions?: string[] }} plan
 * @returns {string}
 */
export function renderAtelierPlanCard(plan) {
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return "";

  const stepsHtml = plan.steps
    .map(
      (s) => `
      <li class="atelier-plan-step ${esc(s.status)}">
        <span class="step-icon">${getStepStatusIcon(s.status)}</span>
        <span class="step-title">${esc(s.title)}</span>
      </li>
    `
    )
    .join("");

  const assumptionsHtml =
    Array.isArray(plan.assumptions) && plan.assumptions.length
      ? `
      <div class="atelier-plan-assumptions">
        <div class="assumptions-header"><i class="fa-solid fa-lightbulb"></i> Suposições</div>
        <ul>
          ${plan.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </div>
    `
      : "";

  return `
    <div class="atelier-plan-card">
      <div class="atelier-plan-header">
        <span class="plan-title"><i class="fa-solid fa-list-check"></i> Plano de Construção</span>
        <span class="plan-count">${plan.steps.filter((s) => s.status === "done").length}/${plan.steps.length} concluído(s)</span>
      </div>
      <ul class="atelier-plan-steps">
        ${stepsHtml}
      </ul>
      ${assumptionsHtml}
    </div>
  `;
}

/**
 * Renderiza o cartão de interação interativa quando o modelo faz perguntas via atelier_ask_user.
 * @param {{ question: string, options?: string[], context?: string }} questionPayload
 * @returns {string}
 */
export function renderAtelierQuestionCard(questionPayload) {
  if (!questionPayload || !questionPayload.question) return "";

  const optionsHtml =
    Array.isArray(questionPayload.options) && questionPayload.options.length
      ? `
      <div class="atelier-question-options">
        ${questionPayload.options
          .map(
            (opt) => `
          <button class="atelier-question-btn" data-answer="${esc(opt)}">
            <i class="fa-solid fa-chevron-right"></i> ${esc(opt)}
          </button>
        `
          )
          .join("")}
      </div>
    `
      : "";

  const contextHtml = questionPayload.context
    ? `<div class="atelier-question-context"><i class="fa-solid fa-circle-info"></i> ${esc(questionPayload.context)}</div>`
    : "";

  return `
    <div class="atelier-question-card">
      <div class="atelier-question-header">
        <i class="fa-solid fa-circle-question"></i> Pergunta do Agente
      </div>
      <div class="atelier-question-body">
        ${esc(questionPayload.question)}
      </div>
      ${contextHtml}
      ${optionsHtml}
    </div>
  `;
}

/**
 * Renderiza um badge compacto indicando a ferramenta em execução ou finalizada.
 * @param {string} toolName
 * @param {"executing" | "done" | "error"} status
 * @returns {string}
 */
export function renderAtelierToolCallBadge(toolName, status = "executing") {
  const icon =
    status === "done"
      ? '<i class="fa-solid fa-check"></i>'
      : status === "error"
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-gear fa-spin"></i>';

  const toolLabels = {
    atelier_plan: "Planejando",
    atelier_write_screen: "Escrevendo tela",
    atelier_patch_styles: "Aplicando estilos",
    atelier_ask_user: "Aguardando resposta",
    atelier_complete: "Finalizando protótipo",
  };

  const label = toolLabels[toolName] || toolName;

  return `
    <span class="atelier-tool-badge ${esc(status)}">
      ${icon} <span>${esc(label)}</span>
    </span>
  `;
}

/**
 * Vincula o clique de botões de opções do cartão de pergunta ao input do chat.
 * @param {HTMLElement} container
 * @param {(answer: string) => void} onAnswer
 */
export function bindQuestionCardActions(container, onAnswer) {
  if (!container || typeof container.addEventListener !== "function" || typeof onAnswer !== "function") return;

  container.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement} */ (e.target)?.closest?.(".atelier-question-btn");
    if (!btn) return;
    const answer = btn.getAttribute("data-answer");
    if (answer) {
      onAnswer(answer);
    }
  });
}
