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
 * Renderiza a réplica visual da Visão geral do paciente (s4).
 * @param {any} sc
 * @returns {string}
 */
export function renderStage4VisaoGeral(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 01. Busca por medicamento -->
      <div class="replica-field-row ${sel === 'busca' ? 'selected' : ''}" onclick="setFocusedField('busca')">
        <label class="replica-label">Filtrar por medicamento</label>
        <div class="replica-input-wrap">
          <input type="text" class="replica-input" placeholder="Digite o nome para filtrar prescrições..." readonly />
          <i class="fa-solid fa-magnifying-glass replica-input-icon"></i>
        </div>
        ${renderMarker("busca", "01", sel === "busca")}
      </div>

      <!-- 02. Entregas liberadas (Tabela) & 03. Gerar entregas -->
      <div class="replica-field-row ${sel === 'entregas' || sel === 'gerar' ? 'selected' : ''}" onclick="setFocusedField('entregas')">
        <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="replica-label" style="font-weight:700; margin:0;"><i class="fa-solid fa-box-archive"></i> Entregas liberadas (1 item pendente)</label>
            <span style="font-size:10px; background:#dbeafe; color:#1e40af; font-weight:700; padding:2px 6px; border-radius:4px;">Disponível</span>
          </div>
          <table class="replica-table-clean">
            <thead>
              <tr>
                <th style="width:30px;"><input type="checkbox" checked readonly disabled /></th>
                <th>Medicamento</th>
                <th>Próxima entrega</th>
                <th>Fim do tratamento</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="checkbox" checked readonly disabled /></td>
                <td><b>LOSARTANA POTASSICA 50MG COMPRIMIDO</b></td>
                <td><span style="color:#16a34a; font-weight:600;">Hoje (15/10/2026)</span></td>
                <td>15/04/2027</td>
              </tr>
            </tbody>
          </table>
          <div style="display:flex; justify-content:flex-end; margin-top:4px;">
            <button type="button" class="replica-btn-primary" style="padding:5px 12px; font-size:11px;" tabindex="-1">
              <i class="fa-solid fa-truck-ramp-box"></i> Gerar entregas selecionadas
            </button>
          </div>
        </div>
        ${renderMarker("entregas", "02", sel === "entregas")}
      </div>

      <!-- 05. Programas de saúde ativos -->
      <div class="replica-field-row ${sel === 'programas' ? 'selected' : ''}" onclick="setFocusedField('programas')">
        <div style="width:100%; display:flex; flex-direction:column; gap:4px;">
          <label class="replica-label" style="font-weight:700; margin:0;"><i class="fa-solid fa-heart-pulse"></i> Programas de saúde ativos</label>
          <div style="font-size:11.5px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; color:#475569;">
            Hipertensão Arterial Sistêmica — Protocolo Gercon 8847291 (Validade: 30/12/2026)
          </div>
        </div>
        ${renderMarker("programas", "05", sel === "programas")}
      </div>

      <!-- 06. Outras prescrições ativas & 07. Situação & 09. Renovar -->
      <div class="replica-field-row ${sel === 'outras' || sel === 'renovar' || sel === 'situacao' ? 'selected' : ''}" onclick="setFocusedField('outras')">
        <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="replica-label" style="font-weight:700; margin:0;"><i class="fa-solid fa-prescription"></i> Outras prescrições</label>
            <span style="font-size:10px; background:#fef3c7; color:#92400e; font-weight:700; padding:2px 6px; border-radius:4px;">Aguardando laudo</span>
          </div>
          <table class="replica-table-clean">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Prescrição</th>
                <th>Validade</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>ATORVASTATINA CALCICA 20MG</b></td>
                <td>#PRESC-2026-904</td>
                <td>30/11/2026</td>
                <td><span style="color:#d97706; font-weight:600;">Renovação pendente</span></td>
              </tr>
            </tbody>
          </table>
          <div style="display:flex; justify-content:flex-end; margin-top:4px;">
            <button type="button" class="replica-btn-outline" style="padding:4px 10px; font-size:11px;" tabindex="-1">
              <i class="fa-solid fa-rotate"></i> Renovar receitas
            </button>
          </div>
        </div>
        ${renderMarker("outras", "06", sel === "outras")}
      </div>
    </div>
  `;
}
