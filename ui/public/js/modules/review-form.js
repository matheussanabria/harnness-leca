// @ts-check
import { $, esc } from "../shared/dom.js";

/**
 * Renderiza o formulário avançado de promoção para projetos migrados (EP-13.06).
 * Permite definir tipo, description (até 140 caracteres), why e how-to-apply.
 * @param {{ id: string, texto: string, categoria: string }} item
 * @param {string} suggestedType
 * @returns {string}
 */
export function renderCuratedPromoteForm(item, suggestedType) {
  const defaultDesc = item.texto.slice(0, 140);
  const types = ["feedback", "project", "reference", "user"];
  const typeOpts = types
    .map((t) => `<option value="${t}" ${t === suggestedType ? "selected" : ""}>${t}</option>`)
    .join("");

  return `
    <div class="rv-curated-form" id="rv-form-${esc(item.id)}">
      <div class="rv-form-row">
        <label>Tipo:</label>
        <select class="rv-select" id="rv-type-${esc(item.id)}">
          ${typeOpts}
        </select>
      </div>
      <div class="rv-form-row">
        <label>Descrição (máx 140 caracteres):</label>
        <input type="text" maxlength="140" class="rv-input" id="rv-desc-${esc(item.id)}" value="${esc(defaultDesc)}">
      </div>
      <div class="rv-form-row" id="rv-why-row-${esc(item.id)}">
        <label>Why (Por quê):</label>
        <textarea class="rv-input" id="rv-why-${esc(item.id)}" placeholder="Justificativa da memória ou regra...">Extraído de conversas e consolidado na revisão.</textarea>
      </div>
      <div class="rv-form-row" id="rv-how-row-${esc(item.id)}">
        <label>How to apply (Como aplicar):</label>
        <textarea class="rv-input" id="rv-how-${esc(item.id)}" placeholder="Instruções para o agente aplicar no projeto...">Seguir no desenvolvimento do projeto.</textarea>
      </div>
      <div class="rv-actions">
        <button data-act="salvar-curado"><i class="fa-solid fa-check"></i> Salvar e Criar Item</button>
        <button data-act="cancelar"><i class="fa-solid fa-xmark"></i> Cancelar</button>
      </div>
    </div>
  `;
}

/**
 * Coleta os dados do formulário de promoção curada para o payload de envio.
 * @param {string} id
 * @returns {{ id: string, acao: "promover", type: string, description: string, why: string, how: string }}
 */
export function getCuratedFormData(id) {
  const type = /** @type {HTMLSelectElement} */ ($(`rv-type-${id}`))?.value || "project";
  const desc = /** @type {HTMLInputElement} */ ($(`rv-desc-${id}`))?.value || "";
  const why = /** @type {HTMLTextAreaElement} */ ($(`rv-why-${id}`))?.value || "";
  const how = /** @type {HTMLTextAreaElement} */ ($(`rv-how-${id}`))?.value || "";
  return {
    id,
    acao: "promover",
    type,
    description: desc,
    why,
    how,
  };
}
