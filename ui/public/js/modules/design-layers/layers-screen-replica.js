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
      <h2 class="dis-page-title">Nova prescrição</h2>

      <div class="dis-form" style="display:flex; flex-direction:column; gap:16px;">
        <h3 class="dis-section-title" style="margin:0;">Origem da receita</h3>

        <!-- 01. Anexar arquivo (dis.button) -->
        <div class="replica-field-row ${sel === 'anexar' ? 'selected' : ''}" onclick="setFocusedField('anexar')">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
              <i class="fa-solid fa-paperclip" aria-hidden="true"></i> Anexar arquivo
            </button>
            <span style="font-size:13px; color:var(--dis-neutral-base);">Nenhum arquivo anexado</span>
          </div>
          ${renderMarker("anexar", "01", sel === "anexar")}
        </div>

        <!-- 02. Estabelecimento de saúde (dis.text-field / autocomplete) -->
        <div class="replica-field-row ${sel === 'estab' ? 'selected' : ''}" onclick="setFocusedField('estab')">
          <div class="ds-field" data-component="dis.text-field" style="flex:1;">
            <label class="ds-field__label">Estabelecimento<span class="ds-req" aria-hidden="true">*</span></label>
            <div class="ds-input-wrap">
              <input type="text" class="ds-input" placeholder="Nome ou código CNES" readonly value="teste" />
              <i class="fa-solid fa-magnifying-glass ds-icon" aria-hidden="true"></i>
            </div>
          </div>
          ${renderMarker("estab", "02", sel === "estab")}
        </div>

        <!-- 03. Atalhos de Estabelecimento (dis.checkbox) -->
        <div class="replica-field-row ${sel === 'atalhos' ? 'selected' : ''}" onclick="setFocusedField('atalhos')" style="margin-top:-6px;">
          <div style="display:flex; gap:24px; flex-wrap:wrap; flex:1;">
            <label class="ds-check" data-component="dis.checkbox">
              <input type="checkbox" disabled />
              <span class="ds-check__box"><i class="fa-solid fa-check"></i></span>
              <span>Serviço privado</span>
            </label>
            <label class="ds-check" data-component="dis.checkbox">
              <input type="checkbox" disabled />
              <span class="ds-check__box"><i class="fa-solid fa-check"></i></span>
              <span>Estabelecimento fora de Porto Alegre</span>
            </label>
          </div>
          ${renderMarker("atalhos", "03", sel === "atalhos")}
        </div>

        <!-- 04. Profissional de saúde (dis.text-field) -->
        <div class="replica-field-row ${sel === 'prof' ? 'selected' : ''}" onclick="setFocusedField('prof')">
          <div class="ds-field" data-component="dis.text-field" style="flex:1;">
            <label class="ds-field__label">Profissional de saúde</label>
            <input type="text" class="ds-input" placeholder="Nome, CPF ou número do conselho" readonly value="" />
          </div>
          ${renderMarker("prof", "04", sel === "prof")}
        </div>

        <!-- 05. Emissão da receita (dis.date-field) -->
        <div class="replica-field-row ${sel === 'emissao' ? 'selected' : ''}" onclick="setFocusedField('emissao')">
          <div class="ds-field" data-component="dis.date-field" style="flex:1;">
            <label class="ds-field__label">Emissão da receita<span class="ds-req" aria-hidden="true">*</span></label>
            <div class="ds-input-wrap" style="width:168px; max-width:100%;">
              <input type="text" class="ds-input" placeholder="dd/mm/aaaa" readonly value="12/31/2313" />
              <i class="fa-solid fa-calendar ds-icon" aria-hidden="true"></i>
            </div>
          </div>
          ${renderMarker("emissao", "05", sel === "emissao")}
        </div>

        <!-- 06. Primeira entrega (dis.date-field + dis.button) -->
        <div class="replica-field-row ${sel === 'primeira' ? 'selected' : ''}" onclick="setFocusedField('primeira')">
          <div class="ds-field" data-component="dis.date-field" style="flex:1;">
            <label class="ds-field__label is-disabled">Primeira entrega</label>
            <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
              <div class="ds-input-wrap is-disabled" style="width:168px; max-width:100%;">
                <input type="text" class="ds-input" placeholder="dd/mm/aaaa" disabled readonly value="" />
                <i class="fa-solid fa-calendar ds-icon" aria-hidden="true"></i>
              </div>
              <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
                <i class="fa-solid fa-key" aria-hidden="true"></i> Editar primeira entrega
              </button>
            </div>
          </div>
          ${renderMarker("primeira", "06", sel === "primeira")}
        </div>
      </div>

      <hr class="dis-hr" style="margin-top:24px;" />

      <!-- 07. Dados do Responsável (dis.radio-group + dis.text-field) -->
      <div class="replica-field-row ${sel === 'resp' ? 'selected' : ''}" onclick="setFocusedField('resp')">
        <div style="flex:1; display:flex; flex-direction:column; gap:16px;">
          <h3 class="dis-section-title">Dados do Responsável</h3>
          <fieldset class="ds-radiogroup" data-component="dis.radio-group">
            <legend class="ds-field__label">Responsável pela retirada<span class="ds-req" aria-hidden="true">*</span></legend>
            <div class="ds-radiogroup__opts">
              <label class="ds-check">
                <input type="radio" name="resp_tipo_fake" checked disabled />
                <span class="ds-radio__dot"></span>
                <span>Próprio paciente</span>
              </label>
              <label class="ds-check">
                <input type="radio" name="resp_tipo_fake" disabled />
                <span class="ds-radio__dot"></span>
                <span>Outra pessoa</span>
              </label>
            </div>
          </fieldset>

          <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="ds-field" data-component="dis.text-field">
              <label class="ds-field__label">E-mail do paciente</label>
              <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                <input type="text" class="ds-input" style="width:400px; max-width:100%;" value="carmen.teixeira@gmail.com" readonly />
                <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
                  <i class="fa-solid fa-envelope" aria-hidden="true"></i> Atualizar e-mail
                </button>
              </div>
            </div>
            <div class="ds-field" data-component="dis.text-field">
              <label class="ds-field__label">Telefone do paciente</label>
              <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                <input type="text" class="ds-input" style="width:240px; max-width:100%;" value="(51) 99999-9999" readonly />
                <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
                  <i class="fa-solid fa-phone" aria-hidden="true"></i> Atualizar telefone
                </button>
              </div>
            </div>
          </div>
        </div>
        ${renderMarker("resp", "07", sel === "resp")}
      </div>

      <!-- 08. Rodapé: Voltar e Próximo (dis.button) -->
      <div class="replica-field-row ${sel === 'proximo' ? 'selected' : ''}" onclick="setFocusedField('proximo')">
        <div class="dis-actions" style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Voltar
          </button>
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" class="btn btn--primary" data-component="dis.button" tabindex="-1">
              Próximo
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
