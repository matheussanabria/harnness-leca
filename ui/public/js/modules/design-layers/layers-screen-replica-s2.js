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
 * Renderiza a réplica visual da Etapa 2 · Medicamentos e cálculo com componentes DIS DS.
 * @param {any} sc
 * @returns {string}
 */
export function renderStage2MedicamentosCalculo(sc) {
  const sel = dls.focusedFieldId;

  return `
    <div class="replica-paper-form">
      <h2 class="dis-page-title">Nova prescrição</h2>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <h3 class="dis-section-title" style="margin:0;">Incluir medicamentos</h3>

        <!-- 01. AutocompleteField de medicamento (dis.autocomplete-field) -->
        <div class="replica-field-row ${sel === 'medicamento' ? 'selected' : ''}" onclick="setFocusedField('medicamento')">
          <div class="ds-field ds-ac" data-component="dis.autocomplete-field" style="flex:1;">
            <label class="ds-field__label">Medicamento<span class="ds-req" aria-hidden="true">*</span></label>
            <div class="ds-input-wrap ds-input-wrap--active">
              <input type="text" class="ds-input" style="border-color:#f97316;" value="1003243 - Dipirona 500mg, comprimido, oral" readonly />
              <i class="fa-solid fa-magnifying-glass ds-icon" aria-hidden="true"></i>
            </div>
          </div>
          ${renderMarker("medicamento", "01", sel === "medicamento")}
        </div>

        <!-- DispensationCalc: Grade de Cadastro + Posologia + Totais -->
        <div class="dis-calc" data-component="dis.dispensation-calc" style="display:flex; flex-direction:column; gap:16px;">
          <!-- 02. Grade do Cadastro (Estoque, Máx, Validade, Modo) -->
          <div class="replica-field-row ${sel === 'cadastro' ? 'selected' : ''}" onclick="setFocusedField('cadastro')">
            <div class="ds-info" style="--cols: 4; flex:1;" data-component="dis.info-grid">
              <div>
                <div class="ds-info__label">Estoque</div>
                <div class="ds-info__value">4020 comprimidos</div>
              </div>
              <div>
                <div class="ds-info__label">Disp. máx. mensal</div>
                <div class="ds-info__value">240 comprimidos</div>
              </div>
              <div>
                <div class="ds-info__label">Validade máx.</div>
                <div class="ds-info__value">180 dias</div>
              </div>
              <div>
                <div class="ds-info__label">Modo de entrega</div>
                <div class="ds-info__value">Uso Contínuo</div>
              </div>
            </div>
            ${renderMarker("cadastro", "02", sel === "cadastro")}
          </div>

          <div class="ds-subhead" style="margin-top:8px;">CÁLCULO DA DISPENSAÇÃO</div>

          <!-- Grade de 4 colunas: Blister | Período | Qtd | Validade -->
          <div class="ds-info" style="--cols: 4; align-items:flex-start;" data-component="dis.info-grid">
            <!-- 03. Comprimidos por blister -->
            <div class="replica-field-row ${sel === 'embalagem' ? 'selected' : ''}" onclick="setFocusedField('embalagem')">
              <div class="ds-field" data-component="dis.text-field" style="flex:1;">
                <label class="ds-field__label">Comprimidos por blister<span class="ds-req">*</span></label>
                <input type="text" class="ds-input" value="30" readonly />
              </div>
              ${renderMarker("embalagem", "03", sel === "embalagem")}
            </div>

            <!-- 04. Comprimidos por (rádios inline) -->
            <div class="replica-field-row ${sel === 'periodo' ? 'selected' : ''}" onclick="setFocusedField('periodo')">
              <div class="ds-field" data-component="dis.radio-group" style="flex:1;">
                <label class="ds-field__label">Comprimidos por<span class="ds-req">*</span></label>
                <div class="ds-radiogroup__opts" style="margin-top:8px; display:flex; gap:10px;">
                  <label class="ds-check">
                    <input type="radio" name="replica_periodo" checked disabled />
                    <span class="ds-radio__dot"></span>
                    <span>dia</span>
                  </label>
                  <label class="ds-check">
                    <input type="radio" name="replica_periodo" disabled />
                    <span class="ds-radio__dot"></span>
                    <span>semana</span>
                  </label>
                  <label class="ds-check">
                    <input type="radio" name="replica_periodo" disabled />
                    <span class="ds-radio__dot"></span>
                    <span>mês</span>
                  </label>
                </div>
              </div>
              ${renderMarker("periodo", "04", sel === "periodo")}
            </div>

            <!-- 05. Comprimidos por dia -->
            <div class="replica-field-row ${sel === 'qtd' ? 'selected' : ''}" onclick="setFocusedField('qtd')">
              <div class="ds-field" data-component="dis.text-field" style="flex:1;">
                <label class="ds-field__label">Comprimidos por dia<span class="ds-req">*</span></label>
                <input type="text" class="ds-input" value="2" readonly />
              </div>
              ${renderMarker("qtd", "05", sel === "qtd")}
            </div>

            <!-- 06. Tratamento/validade -->
            <div class="replica-field-row ${sel === 'tratamento' ? 'selected' : ''}" onclick="setFocusedField('tratamento')">
              <div class="ds-field" data-component="dis.text-field" style="flex:1;">
                <label class="ds-field__label">Tratamento/validade<span class="ds-req">*</span></label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="text" class="ds-input" style="width:80px;" value="60" readonly />
                  <span style="font-size:13px; color:var(--dis-neutral-body);">dias</span>
                </div>
              </div>
              ${renderMarker("tratamento", "06", sel === "tratamento")}
            </div>
          </div>

          <!-- Grade de 4 colunas: Totais e Entrega Atual -->
          <div class="ds-info" style="--cols: 4; align-items:flex-end; margin-top:8px;" data-component="dis.info-grid">
            <div>
              <div class="ds-info__label">Total prescrito</div>
              <div class="ds-info__value">120 comprimidos</div>
            </div>
            <div>
              <div class="ds-info__label">Total a entregar</div>
              <div class="ds-info__value">4 blísteres (120 comprimidos)</div>
            </div>
            <div>
              <div class="ds-info__label">Liberado para entrega</div>
              <div class="ds-info__value"><b>2 blísteres</b> (60 comprimidos)</div>
            </div>
            <!-- 07. Entrega atual editável -->
            <div class="replica-field-row ${sel === 'resultado' ? 'selected' : ''}" onclick="setFocusedField('resultado')">
              <div class="ds-field" style="flex:1;">
                <label class="ds-field__label">Entrega atual<span class="ds-req">*</span></label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="text" class="ds-input" style="width:80px;" value="2" readonly />
                  <span style="font-size:13px; color:var(--dis-neutral-body);">blísteres</span>
                </div>
              </div>
              ${renderMarker("resultado", "07", sel === "resultado")}
            </div>
          </div>

          <!-- Entregas previstas -->
          <div class="replica-field-row ${sel === 'cronograma' ? 'selected' : ''}" onclick="setFocusedField('cronograma')" style="margin-top:10px;">
            <div class="dis-calc__plan" style="flex:1;">
              <div class="ds-info__label" style="margin-bottom:6px;">Entregas previstas</div>
              <div class="dis-hist" style="font-size:12.5px; color:var(--dis-neutral-dark); line-height:1.4;">
                <div class="dis-hist__date" style="font-weight:600;">10/01/2026</div>
                <div>2 blísteres (60 comprimidos)</div>
              </div>
            </div>
            ${renderMarker("cronograma", "09", sel === "cronograma")}
          </div>

          <!-- Linha de Ações: Cancelar e + Incluir -->
          <div class="replica-field-row ${sel === 'incluir' ? 'selected' : ''}" onclick="setFocusedField('incluir')">
            <div style="width:100%; display:flex; justify-content:flex-end; align-items:center; gap:16px;">
              <button type="button" class="btn btn--tertiary" data-component="dis.button" tabindex="-1">Cancelar</button>
              <button type="button" class="btn btn--primary" data-component="dis.button" tabindex="-1">
                <i class="fa-solid fa-plus" aria-hidden="true"></i> Incluir
              </button>
            </div>
            ${renderMarker("incluir", "11", sel === "incluir")}
          </div>
        </div>

        <!-- Rodapé da Página: Anterior e Dispensar -->
        <div class="dis-actions" style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid var(--dis-neutral-light); padding-top:16px;">
          <button type="button" class="btn btn--secondary" data-component="dis.button" tabindex="-1">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Anterior
          </button>
          <button type="button" class="btn btn--primary" style="opacity:0.85;" data-component="dis.button" tabindex="-1">
            <i class="fa-solid fa-check" aria-hidden="true"></i> Dispensar
          </button>
        </div>
      </div>
    </div>
  `;
}
