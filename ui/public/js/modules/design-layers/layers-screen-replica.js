// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { renderStage2MedicamentosCalculo } from "./layers-screen-replica-s2.js";
import { renderStage3SucessoEntrega } from "./layers-screen-replica-s3.js";
import { renderStage4VisaoGeral } from "./layers-screen-replica-s4.js";

/**
 * Renderiza o marcador circular amarelo numerado.
 * @param {string} fieldId
 * @param {string|number} num
 * @param {boolean} isSelected
 */
function renderMarker(fieldId, num, isSelected) {
  const pad = typeof num === "number" ? ("0" + num).slice(-2) : num;
  return `
    <button type="button" class="replica-marker-pin ${isSelected ? 'active' : ''}" onclick="event.stopPropagation(); setFocusedField('${esc(fieldId)}')" title="Filtrar camadas pelo campo ${pad}" aria-label="Marcador ${pad}">
      ${esc(pad)}
    </button>
  `;
}

/**
 * Renderiza a réplica fiel da Etapa 1 · Origem da receita (9 campos documentados).
 * @param {any} sc
 */
function renderStage1OrigemReceita(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 09. Aviso da Prévia -->
      <div class="replica-field-row ${sel === 'aviso' ? 'selected' : ''}" onclick="setFocusedField('aviso')">
        <div class="replica-alert-info">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <b>Aviso importante:</b> Esta tela calcula uma prévia do cronograma de entregas. Nada é gravado no sistema nesta etapa.
          </div>
        </div>
        ${renderMarker("aviso", "09", sel === "aviso")}
      </div>

      <!-- 01. Anexar arquivo -->
      <div class="replica-field-row ${sel === 'anexar' ? 'selected' : ''}" onclick="setFocusedField('anexar')">
        <div class="replica-attach-group">
          <button type="button" class="replica-btn-outline" tabindex="-1">
            <i class="fa-solid fa-paperclip"></i> Anexar arquivo
          </button>
          <span class="replica-attach-hint">Nenhum arquivo anexado</span>
        </div>
        ${renderMarker("anexar", "01", sel === "anexar")}
      </div>

      <!-- 02. Estabelecimento de saúde -->
      <div class="replica-field-row ${sel === 'estab' ? 'selected' : ''}" onclick="setFocusedField('estab')">
        <label class="replica-label">Estabelecimento de saúde <span class="req">*</span></label>
        <div class="replica-input-wrap">
          <input type="text" class="replica-input" placeholder="Nome ou código CNES" readonly value="" />
          <i class="fa-solid fa-magnifying-glass replica-input-icon"></i>
        </div>
        ${renderMarker("estab", "02", sel === "estab")}
      </div>

      <!-- 03. Atalhos de Estabelecimento -->
      <div class="replica-field-row ${sel === 'atalhos' ? 'selected' : ''}" onclick="setFocusedField('atalhos')">
        <div class="replica-checkbox-group">
          <label class="replica-check-item">
            <input type="checkbox" readonly disabled />
            <span>Serviço privado (CNES 9999999)</span>
          </label>
          <label class="replica-check-item">
            <input type="checkbox" readonly disabled />
            <span>Fora de Porto Alegre (CNES 9999998)</span>
          </label>
        </div>
        ${renderMarker("atalhos", "03", sel === "atalhos")}
      </div>

      <!-- 04. Profissional prescritor -->
      <div class="replica-field-row ${sel === 'prof' ? 'selected' : ''}" onclick="setFocusedField('prof')">
        <label class="replica-label">Profissional prescritor</label>
        <div class="replica-input-wrap">
          <input type="text" class="replica-input" placeholder="Nome, CPF ou número do conselho" readonly value="" />
          <i class="fa-solid fa-magnifying-glass replica-input-icon"></i>
        </div>
        ${renderMarker("prof", "04", sel === "prof")}
      </div>

      <!-- 05. Emissão da receita -->
      <div class="replica-field-row ${sel === 'emissao' ? 'selected' : ''}" onclick="setFocusedField('emissao')">
        <div style="flex:1;">
          <label class="replica-label">Emissão da receita <span class="req">*</span></label>
          <div class="replica-input-wrap replica-date-wrap">
            <input type="text" class="replica-input" placeholder="dd/mm/aaaa" readonly value="" />
            <i class="fa-regular fa-calendar replica-input-icon"></i>
          </div>
        </div>
        ${renderMarker("emissao", "05", sel === "emissao")}
      </div>

      <!-- 06. Primeira entrega -->
      <div class="replica-field-row ${sel === 'primeira' ? 'selected' : ''}" onclick="setFocusedField('primeira')">
        <div style="flex:1;">
          <label class="replica-label">Primeira entrega</label>
          <div style="display:flex; gap:6px;">
            <div class="replica-input-wrap replica-date-wrap" style="flex:1;">
              <input type="text" class="replica-input" placeholder="dd/mm/aaaa" readonly value="" />
              <i class="fa-regular fa-calendar replica-input-icon"></i>
            </div>
            <button type="button" class="replica-btn-outline" style="white-space:nowrap; font-size:11px;" tabindex="-1">
              <i class="fa-solid fa-pen"></i> Editar primeira entrega
            </button>
          </div>
        </div>
        ${renderMarker("primeira", "06", sel === "primeira")}
      </div>

      <div class="replica-section-divider"></div>

      <!-- 07. Dados de Responsável -->
      <div class="replica-field-row ${sel === 'resp' ? 'selected' : ''}" onclick="setFocusedField('resp')">
        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <div style="font-weight:700; font-size:12px; color:#1e293b;">Dados de Responsável</div>
          <div style="font-size:11px; color:#64748b;">Responsável pela retirada <span class="req">*</span></div>
          <div class="replica-radio-group">
            <label class="replica-radio-item">
              <input type="radio" name="resp_tipo_fake" checked disabled />
              <span>Próprio paciente</span>
            </label>
            <label class="replica-radio-item">
              <input type="radio" name="resp_tipo_fake" disabled />
              <span>Outra pessoa</span>
            </label>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px; margin-top:2px;">
            <div class="replica-subfield">
              <label class="replica-label-sm">E-mail do paciente</label>
              <div class="replica-inline-input-btn">
                <input type="text" class="replica-input" value="matheus.capes@gmail.com" readonly />
                <button type="button" class="replica-btn-outline" tabindex="-1">Atualizar e-mail</button>
              </div>
            </div>
            <div class="replica-subfield">
              <label class="replica-label-sm">Telefone do paciente</label>
              <div class="replica-inline-input-btn">
                <input type="text" class="replica-input" value="(51) 99206-2054" readonly />
                <button type="button" class="replica-btn-outline" tabindex="-1">Atualizar telefone</button>
              </div>
            </div>
          </div>
        </div>
        ${renderMarker("resp", "07", sel === "resp")}
      </div>

      <!-- 08. Próximo e Voltar -->
      <div class="replica-field-row replica-footer-row ${sel === 'proximo' ? 'selected' : ''}" onclick="setFocusedField('proximo')">
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="replica-btn-outline" tabindex="-1">&lt; Voltar</button>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="replica-btn-primary" tabindex="-1">
              <span>Próximo</span>
            </button>
            ${renderMarker("proximo", "08", sel === "proximo")}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza um formulário dinâmico para outras etapas (s2, s3, s4).
 * @param {any} sc
 */
function renderGenericStageReplica(sc) {
  const sel = dls.focusedFieldId;
  const fields = sc.fields || [];

  const rows = fields.map((f, idx) => {
    const isSelected = sel === f.id;
    const num = f.n || idx + 1;
    return `
      <div class="replica-field-row ${isSelected ? 'selected' : ''}" onclick="setFocusedField('${esc(f.id)}')">
        <div class="replica-field-content">
          <label class="replica-label">${esc(f.label || f.id)}</label>
          <div class="replica-input-wrap">
            <input type="text" class="replica-input" placeholder="${esc(f.ui?.t || f.label)}" readonly value="" />
          </div>
          ${f.ui?.c ? `<div class="replica-field-meta"><code>&lt;${esc(f.ui.c)}&gt;</code></div>` : ""}
        </div>
        ${renderMarker(f.id, num, isSelected)}
      </div>
    `;
  }).join("");

  return `
    <div class="replica-paper-form">
      <div class="replica-generic-title">
        <b>${esc(sc.title || "Formulário de Negócio")}</b>
        <span class="replica-route-badge">${esc(sc.route || "")}</span>
      </div>
      ${rows}
    </div>
  `;
}

/**
 * Renderiza a réplica visual interativa da tela de negócio (Coluna Esquerda).
 * @param {any} sc
 * @returns {string}
 */
export function renderScreenReplica(sc) {
  if (!sc) return '<div class="replica-empty">Nenhuma tela selecionada.</div>';

  let formHtml = "";
  if (sc.id === "s1" || /origem/i.test(sc.title || "")) {
    formHtml = renderStage1OrigemReceita(sc);
  } else if (sc.id === "s2" || /medicamento/i.test(sc.title || "")) {
    formHtml = renderStage2MedicamentosCalculo(sc);
  } else if (sc.id === "s3" || /sucesso/i.test(sc.title || "")) {
    formHtml = renderStage3SucessoEntrega(sc);
  } else if (sc.id === "s4" || /visao/i.test(sc.title || "")) {
    formHtml = renderStage4VisaoGeral(sc);
  } else {
    formHtml = renderGenericStageReplica(sc);
  }

  return `
    <div class="replica-outer-frame">
      <div class="replica-frame-topbar">
        <div class="replica-window-dots">
          <span class="dot-red"></span>
          <span class="dot-yellow"></span>
          <span class="dot-green"></span>
        </div>
        <div class="replica-stage-tag">
          <i class="fa-solid fa-window-maximize"></i>
          <span>${esc(sc.title || "Tela")}</span>
        </div>
        <div class="replica-route-tag">
          <code>${esc(sc.route || "dispensacao")}</code>
        </div>
      </div>

      <div class="replica-viewport-scroll">
        ${formHtml}
      </div>

      <div class="replica-frame-footer">
        <div class="replica-footer-hint">
          <i class="fa-solid fa-arrow-pointer"></i>
          <span>Clique em um campo ou no marcador amarelo para rastrear em todas as 6 camadas.</span>
        </div>
        ${dls.focusedFieldId ? `
          <button type="button" class="btn-clear-selection-pill" onclick="setFocusedField(null)" title="Limpar seleção de campo">
            <i class="fa-solid fa-xmark"></i> Limpar seleção
          </button>
        ` : ''}
      </div>
    </div>
  `;
}
