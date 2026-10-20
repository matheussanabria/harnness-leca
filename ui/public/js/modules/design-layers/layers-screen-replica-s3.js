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
 * Renderiza a réplica visual da Tela 3 · Sucesso da entrega (4 elementos).
 * @param {any} sc
 * @returns {string}
 */
export function renderStage3SucessoEntrega(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 01. Alerta de sucesso -->
      <div class="replica-field-row ${sel === 'aviso' ? 'selected' : ''}" onclick="setFocusedField('aviso')">
        <div class="replica-alert-success">
          <i class="fa-solid fa-circle-check"></i>
          <div>Medicamentos dispensados com sucesso.</div>
        </div>
        ${renderMarker("aviso", "01", sel === "aviso")}
      </div>

      <!-- 02. Medicamentos entregues (Tabela) -->
      <div class="replica-field-row ${sel === 'entregues' ? 'selected' : ''}" onclick="setFocusedField('entregues')">
        <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="replica-label" style="font-weight:700; margin:0;">Medicamentos entregues</label>
            <span style="font-size:11px; color:#64748b;">2 itens registrados</span>
          </div>
          <table class="replica-table-clean">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th style="width:110px;">Quantidade</th>
                <th style="width:90px; text-align:center;">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>DIPIRONA MONOIDRATADA 500MG COMPRIMIDO</b></td>
                <td>60 comprimidos</td>
                <td style="text-align:center;">
                  <button type="button" class="replica-btn-outline" style="color:#ef4444; border-color:#fca5a5; padding:2px 8px; font-size:10.5px;" tabindex="-1">
                    <i class="fa-solid fa-rotate-left"></i> Estornar
                  </button>
                </td>
              </tr>
              <tr>
                <td><b>LOSARTANA POTASSICA 50MG COMPRIMIDO</b></td>
                <td>30 comprimidos</td>
                <td style="text-align:center;">
                  <button type="button" class="replica-btn-outline" style="color:#ef4444; border-color:#fca5a5; padding:2px 8px; font-size:10.5px;" tabindex="-1">
                    <i class="fa-solid fa-rotate-left"></i> Estornar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        ${renderMarker("entregues", "02", sel === "entregues")}
      </div>

      <!-- 03. Próximas entregas (Cartões 3 colunas) -->
      <div class="replica-field-row ${sel === 'proximas' ? 'selected' : ''}" onclick="setFocusedField('proximas')">
        <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
          <label class="replica-label" style="font-weight:700; margin:0;">Próximas entregas previstas</label>
          <div class="replica-cards-3col">
            <div class="replica-delivery-card">
              <span class="delivery-card-title">1ª Próxima entrega</span>
              <span class="delivery-card-date"><i class="fa-regular fa-calendar"></i> 15/11/2026</span>
              <span class="delivery-card-med">Dipirona 500mg (60 comp)</span>
            </div>
            <div class="replica-delivery-card">
              <span class="delivery-card-title">2ª Próxima entrega</span>
              <span class="delivery-card-date"><i class="fa-regular fa-calendar"></i> 15/12/2026</span>
              <span class="delivery-card-med">Dipirona 500mg (60 comp)</span>
            </div>
            <div class="replica-delivery-card">
              <span class="delivery-card-title">3ª Próxima entrega</span>
              <span class="delivery-card-date"><i class="fa-regular fa-calendar"></i> 15/01/2027</span>
              <span class="delivery-card-med">Dipirona 500mg (60 comp)</span>
            </div>
          </div>
        </div>
        ${renderMarker("proximas", "03", sel === "proximas")}
      </div>

      <!-- 04. Página do paciente (Ação de retorno) -->
      <div class="replica-field-row ${sel === 'pagina' ? 'selected' : ''}" onclick="setFocusedField('pagina')">
        <div style="width:100%; display:flex; align-items:center; justify-content:space-between;">
          <button type="button" class="replica-btn-outline" style="font-weight:600; padding:8px 16px;" tabindex="-1">
            <i class="fa-solid fa-arrow-left"></i> Página do paciente
          </button>
          <span style="font-size:11.5px; color:#64748b;">Retorna à visão geral com dados atualizados</span>
        </div>
        ${renderMarker("pagina", "04", sel === "pagina")}
      </div>
    </div>
  `;
}
