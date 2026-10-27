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
 * Renderiza a réplica visual da Tela 3 · Sucesso da entrega com componentes DIS DS.
 * @param {any} sc
 * @returns {string}
 */
export function renderStage3SucessoEntrega(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <!-- 01. Alerta de sucesso (dis.alert) -->
      <div class="replica-field-row ${sel === 'aviso' ? 'selected' : ''}" onclick="setFocusedField('aviso')">
        <div class="ds-alert ds-alert--success ds-alert--inline" role="status" data-component="dis.alert" style="flex:1;">
          <div class="ds-alert__icon" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></div>
          <div class="ds-alert__content">
            <div class="ds-alert__body">Medicamentos dispensados com sucesso.</div>
          </div>
        </div>
        ${renderMarker("aviso", "01", sel === "aviso")}
      </div>

      <!-- 02. Medicamentos entregues (dis.dispensed-medication-list / dis.data-table) -->
      <div class="replica-field-row ${sel === 'entregues' ? 'selected' : ''}" onclick="setFocusedField('entregues')">
        <section class="dis-medtable dis-medtable--dispensed" aria-label="Medicamentos entregues" style="width:100%;" data-component="dis.dispensed-medication-list">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 class="dis-section-title" style="margin:0;">Medicamentos entregues</h3>
            <span style="font-size:12px; color:var(--dis-neutral-base);">2 itens registrados</span>
          </div>
          <table class="ds-table ds-table--compact" data-component="dis.data-table">
            <thead>
              <tr>
                <th scope="col" style="width:50%;">Medicamento</th>
                <th scope="col" style="width:30%;">Quantidade</th>
                <th scope="col" style="text-align:right;">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <button type="button" class="ds-medlink" data-component="dis.expand-link" tabindex="-1">
                    DIPIRONA MONOIDRATADA 500MG COMPRIMIDO
                  </button>
                </td>
                <td>2 blísteres (60 comp)</td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn--tertiary btn--danger" style="padding:0 8px; min-height:28px; font-size:11.5px;" data-component="dis.button" tabindex="-1">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i> Estornar
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <button type="button" class="ds-medlink" data-component="dis.expand-link" tabindex="-1">
                    LOSARTANA POTASSICA 50MG COMPRIMIDO
                  </button>
                </td>
                <td>1 blíster (30 comp)</td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn--tertiary btn--danger" style="padding:0 8px; min-height:28px; font-size:11.5px;" data-component="dis.button" tabindex="-1">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i> Estornar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        ${renderMarker("entregues", "02", sel === "entregues")}
      </div>

      <!-- 03. Próximas entregas previstas (dis.info-grid / cartões DIS) -->
      <div class="replica-field-row ${sel === 'proximas' ? 'selected' : ''}" onclick="setFocusedField('proximas')">
        <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
          <h3 class="dis-section-title" style="margin:0;">Próximas entregas previstas</h3>
          <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px;">
            <div style="background:var(--dis-neutral-background); border:1px solid var(--dis-neutral-light); border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; color:var(--dis-primary-headings); margin-bottom:4px; font-size:13px;">15/11/2026</div>
              <div style="font-size:12.5px; color:var(--dis-neutral-body);">Dipirona 500mg, oral</div>
              <div style="font-size:11.5px; color:var(--dis-neutral-dark); margin-top:2px;">2 blísteres (60 comp)</div>
            </div>
            <div style="background:var(--dis-neutral-background); border:1px solid var(--dis-neutral-light); border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; color:var(--dis-primary-headings); margin-bottom:4px; font-size:13px;">15/12/2026</div>
              <div style="font-size:12.5px; color:var(--dis-neutral-body);">Dipirona 500mg, oral</div>
              <div style="font-size:11.5px; color:var(--dis-neutral-dark); margin-top:2px;">2 blísteres (60 comp)</div>
            </div>
            <div style="background:var(--dis-neutral-background); border:1px solid var(--dis-neutral-light); border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; color:var(--dis-primary-headings); margin-bottom:4px; font-size:13px;">15/01/2027</div>
              <div style="font-size:12.5px; color:var(--dis-neutral-body);">Dipirona 500mg, oral</div>
              <div style="font-size:11.5px; color:var(--dis-neutral-dark); margin-top:2px;">2 blísteres (60 comp)</div>
            </div>
          </div>
        </div>
        ${renderMarker("proximas", "03", sel === "proximas")}
      </div>

      <!-- 04. Página do paciente (dis.button) -->
      <div class="replica-field-row ${sel === 'pagina' ? 'selected' : ''}" onclick="setFocusedField('pagina')">
        <div style="width:100%; display:flex; align-items:center; justify-content:space-between; padding-top:6px;">
          <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Página do paciente
          </button>
          <span style="font-size:12px; color:var(--dis-neutral-base);">Retorna à visão geral com cronograma sincronizado</span>
        </div>
        ${renderMarker("pagina", "04", sel === "pagina")}
      </div>
    </div>
  `;
}
