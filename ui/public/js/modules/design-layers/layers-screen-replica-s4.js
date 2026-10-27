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
 * Renderiza a réplica visual da Visão geral do paciente (s4) com componentes DIS DS.
 * @param {any} sc
 * @returns {string}
 */
export function renderStage4VisaoGeral(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 01. Pesquisar medicamento (dis.search-field) -->
      <div class="replica-field-row ${sel === 'busca' ? 'selected' : ''}" onclick="setFocusedField('busca')">
        <div class="ds-search" data-component="dis.search-field" style="width:100%; display:flex; align-items:flex-end; gap:16px;">
          <div class="ds-search__field" style="flex:1;">
            <label class="ds-search__label" style="font-size:13px; font-weight:700; color:var(--dis-primary-headings);">Pesquisar medicamento</label>
            <div class="ds-input-wrap">
              <input type="text" class="ds-input" placeholder="Digite o nome para filtrar prescrições..." readonly />
              <i class="fa-solid fa-magnifying-glass ds-icon" aria-hidden="true"></i>
            </div>
          </div>
          <button type="button" class="btn btn--tertiary" data-component="dis.button" tabindex="-1">Limpar filtros</button>
        </div>
        ${renderMarker("busca", "01", sel === "busca")}
      </div>

      <!-- 02. Entregas liberadas (dis.collapsible-card + dis.data-table) & 03. Gerar entregas -->
      <div class="replica-field-row ${sel === 'entregas' || sel === 'gerar' ? 'selected' : ''}" onclick="setFocusedField('entregas')">
        <section class="ds-card" style="width:100%;" data-component="dis.collapsible-card">
          <div class="ds-card__head">
            <h2 class="ds-card__title">Entregas liberadas</h2>
            <span class="ds-count" data-component="dis.count-badge">1</span>
            <span class="ds-badge ds-badge--success" style="margin-left:auto;">Disponível</span>
          </div>
          <div class="ds-card__body">
            <table class="ds-table ds-table--compact" data-component="dis.data-table">
              <thead>
                <tr>
                  <th class="ds-td--check">
                    <label class="ds-check" data-component="dis.checkbox">
                      <input type="checkbox" checked disabled />
                      <span class="ds-check__box"><i class="fa-solid fa-check"></i></span>
                    </label>
                  </th>
                  <th scope="col">Medicamento</th>
                  <th scope="col">Próxima entrega</th>
                  <th scope="col">Fim do tratamento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="ds-td--check">
                    <label class="ds-check" data-component="dis.checkbox">
                      <input type="checkbox" checked disabled />
                      <span class="ds-check__box"><i class="fa-solid fa-check"></i></span>
                    </label>
                  </td>
                  <td>
                    <button type="button" class="ds-medlink" data-component="dis.expand-link" tabindex="-1">
                      LOSARTANA POTASSICA 50MG COMPRIMIDO
                    </button>
                  </td>
                  <td><span style="color:var(--dis-success-dark); font-weight:700;">Hoje (15/10/2026)</span></td>
                  <td>15/04/2027</td>
                </tr>
              </tbody>
            </table>
            <div class="ds-card__foot">
              <button type="button" class="btn btn--primary" data-component="dis.button" tabindex="-1">
                <i class="fa-solid fa-truck-ramp-box" aria-hidden="true"></i> Gerar entregas
              </button>
            </div>
          </div>
        </section>
        ${renderMarker("entregas", "02", sel === "entregas")}
      </div>

      <!-- 05. Programas de saúde ativos (dis.collapsible-card + dis.data-table) -->
      <div class="replica-field-row ${sel === 'programas' ? 'selected' : ''}" onclick="setFocusedField('programas')">
        <section class="ds-card" style="width:100%;" data-component="dis.collapsible-card">
          <div class="ds-card__head">
            <h2 class="ds-card__title">Programas de saúde ativos</h2>
            <span class="ds-count" data-component="dis.count-badge">1</span>
          </div>
          <div class="ds-card__body">
            <table class="ds-table ds-table--compact" data-component="dis.data-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Laudo</th>
                  <th>Validade</th>
                  <th>Protocolo Gercon</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <button type="button" class="ds-medlink" data-component="dis.expand-link" tabindex="-1">
                      Hipertensão Arterial Sistêmica (HAS)
                    </button>
                  </td>
                  <td>05/10/2026</td>
                  <td>30/12/2026</td>
                  <td>8847291</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        ${renderMarker("programas", "05", sel === "programas")}
      </div>

      <!-- 06. Outras prescrições ativas & 07. Situação & 09. Renovar -->
      <div class="replica-field-row ${sel === 'outras' || sel === 'renovar' || sel === 'situacao' ? 'selected' : ''}" onclick="setFocusedField('outras')">
        <section class="ds-card" style="width:100%;" data-component="dis.collapsible-card">
          <div class="ds-card__head">
            <h2 class="ds-card__title">Outras prescrições ativas</h2>
            <span class="ds-count" data-component="dis.count-badge">1</span>
            <span class="ds-badge ds-badge--warning" style="margin-left:auto;">Aguardando laudo</span>
          </div>
          <div class="ds-card__body">
            <table class="ds-table ds-table--compact" data-component="dis.data-table">
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
                  <td>
                    <button type="button" class="ds-medlink" data-component="dis.expand-link" tabindex="-1">
                      ATORVASTATINA CALCICA 20MG
                    </button>
                  </td>
                  <td>#PRESC-2026-904</td>
                  <td>30/11/2026</td>
                  <td><span class="ds-badge ds-badge--neutral">Renovação pendente</span></td>
                </tr>
              </tbody>
            </table>
            <div class="ds-card__foot">
              <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
                <i class="fa-solid fa-rotate" aria-hidden="true"></i> Renovar receitas
              </button>
            </div>
          </div>
        </section>
        ${renderMarker("outras", "06", sel === "outras")}
      </div>
    </div>
  `;
}
