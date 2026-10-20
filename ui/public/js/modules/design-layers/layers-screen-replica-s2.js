// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";

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
 * Renderiza a réplica visual da Etapa 2 · Medicamentos e cálculo.
 * @param {any} sc
 * @returns {string}
 */
export function renderStage2MedicamentosCalculo(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 01. Busca de medicamento -->
      <div class="replica-field-row ${sel === 'medicamento' ? 'selected' : ''}" onclick="setFocusedField('medicamento')">
        <label class="replica-label">Medicamento <span class="req">*</span></label>
        <div class="replica-input-wrap">
          <input type="text" class="replica-input" value="LOSARTANA POTASSICA 50MG COMPRIMIDO" readonly />
          <i class="fa-solid fa-magnifying-glass replica-input-icon"></i>
        </div>
        ${renderMarker("medicamento", "01", sel === "medicamento")}
      </div>

      <!-- 02. Grade do Cadastro (Estoque, Máx, Validade, Modo) -->
      <div class="replica-field-row ${sel === 'cadastro' ? 'selected' : ''}" onclick="setFocusedField('cadastro')">
        <div class="replica-info-grid-4">
          <div class="replica-info-box">
            <span class="replica-info-box-lbl">Estoque</span>
            <span class="replica-info-box-val" style="color:#16a34a;">1.450 comp</span>
          </div>
          <div class="replica-info-box">
            <span class="replica-info-box-lbl">Disp. máx. mensal</span>
            <span class="replica-info-box-val">60 comp</span>
          </div>
          <div class="replica-info-box">
            <span class="replica-info-box-lbl">Validade máx.</span>
            <span class="replica-info-box-val">365 dias</span>
          </div>
          <div class="replica-info-box">
            <span class="replica-info-box-lbl">Modo de entrega</span>
            <span class="replica-info-box-val">Ciclos regulares</span>
          </div>
        </div>
        ${renderMarker("cadastro", "02", sel === "cadastro")}
      </div>

      <!-- 14. Intervalo entre retiradas -->
      <div class="replica-field-row ${sel === 'intervalo' ? 'selected' : ''}" onclick="setFocusedField('intervalo')">
        <div style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span><b>Intervalo entre retiradas:</b> 60 dias (classificação cadastral não editável)</span>
        </div>
        ${renderMarker("intervalo", "14", sel === "intervalo")}
      </div>

      <!-- 03. Embalagem & 04. Período & 05. Qtd -->
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; width:100%;">
        <div class="replica-field-row ${sel === 'embalagem' ? 'selected' : ''}" onclick="setFocusedField('embalagem')">
          <div style="flex:1;">
            <label class="replica-label">Unid. / blister</label>
            <input type="text" class="replica-input" value="30" readonly />
          </div>
          ${renderMarker("embalagem", "03", sel === "embalagem")}
        </div>

        <div class="replica-field-row ${sel === 'periodo' ? 'selected' : ''}" onclick="setFocusedField('periodo')">
          <div style="flex:1;">
            <label class="replica-label">Período</label>
            <input type="text" class="replica-input" value="Por dia" readonly />
          </div>
          ${renderMarker("periodo", "04", sel === "periodo")}
        </div>

        <div class="replica-field-row ${sel === 'qtd' ? 'selected' : ''}" onclick="setFocusedField('qtd')">
          <div style="flex:1;">
            <label class="replica-label">Qtd. / período <span class="req">*</span></label>
            <input type="text" class="replica-input" value="1 comp" readonly />
          </div>
          ${renderMarker("qtd", "05", sel === "qtd")}
        </div>
      </div>

      <!-- 06. Tratamento e Validade -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; width:100%;">
        <div class="replica-field-row ${sel === 'tratamento' ? 'selected' : ''}" onclick="setFocusedField('tratamento')">
          <div style="flex:1;">
            <label class="replica-label">Tratamento (dias) <span class="req">*</span></label>
            <input type="text" class="replica-input" value="180" readonly />
          </div>
          ${renderMarker("tratamento", "06", sel === "tratamento")}
        </div>
        <div class="replica-field-row ${sel === 'resultado' ? 'selected' : ''}" onclick="setFocusedField('resultado')">
          <div style="flex:1;">
            <label class="replica-label">Total a liberar</label>
            <input type="text" class="replica-input" style="font-weight:700; color:#2563eb;" value="180 comp (60 / mês)" readonly />
          </div>
          ${renderMarker("resultado", "07", sel === "resultado")}
        </div>
      </div>

      <!-- 09. Cronograma e Entregas Previstas -->
      <div class="replica-field-row ${sel === 'cronograma' ? 'selected' : ''}" onclick="setFocusedField('cronograma')">
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px;">
          <span style="font-size:11.5px; font-weight:600; color:#1e293b;"><i class="fa-solid fa-calendar-days"></i> Entregas previstas: 3 remessas de 60 comprimidos</span>
          <span style="font-size:11px; color:#2563eb;"><i class="fa-solid fa-chevron-up"></i></span>
        </div>
        ${renderMarker("cronograma", "09", sel === "cronograma")}
      </div>

      <!-- 11. Incluir na Prescrição -->
      <div class="replica-field-row ${sel === 'incluir' ? 'selected' : ''}" onclick="setFocusedField('incluir')">
        <div style="width:100%; display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="replica-btn-outline" tabindex="-1">Voltar</button>
          <button type="button" class="replica-btn-primary" tabindex="-1"><i class="fa-solid fa-plus"></i> Incluir na Prescrição</button>
        </div>
        ${renderMarker("incluir", "11", sel === "incluir")}
      </div>
    </div>
  `;
}
