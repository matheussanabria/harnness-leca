// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { STATUS_MAP } from "./layers-state.js";

/**
 * Cria a função de filtro de referências para a camada ativa.
 */
export function filterByFocusedField(items) {
  if (!dls.focusedFieldId) return items;
  return (items || []).filter((it) => {
    if (it.id === dls.focusedFieldId) return true;
    if (Array.isArray(it.refs) && it.refs.includes(dls.focusedFieldId)) return true;
    return false;
  });
}

/**
 * Renderiza a Camada 1: UI e UX.
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailUiLayer(sc) {
  const rawFields = sc.fields || [];
  const fields = filterByFocusedField(rawFields);
  const flow = sc.flow || [];
  const diffs = filterByFocusedField(sc.diffs || []);
  const states = sc.states || [];

  const fieldsCards = fields.map((f) => {
    const isSelected = dls.focusedFieldId === f.id;
    const stKey = f.ui?.st || "ok";
    const stMeta = STATUS_MAP[stKey] || STATUS_MAP.ok;

    return `
      <div class="compact-info-card ${isSelected ? 'highlight-active' : ''}" onclick="setFocusedField('${esc(f.id)}')">
        <div class="card-compact-head">
          <div class="card-head-title">
            <span class="field-pill-num">${esc(f.n || f.id)}</span>
            <b>${esc(f.label || f.id)}</b>
          </div>
          <span class="status-badge" style="color:${stMeta.color};background:${stMeta.bg}">
            ${esc(stMeta.label)}
          </span>
        </div>

        <div class="card-compact-body">
          <p class="card-desc-text">${esc(f.ui?.t || "Elemento visual de interface.")}</p>
          ${f.ui?.c ? `
            <div class="card-code-tag">
              <i class="fa-solid fa-code"></i> <code>&lt;${esc(f.ui.c)}&gt;</code>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-shapes"></i> Elementos e Campos da Tela</h3>
          <span class="section-count-badge">${fields.length} de ${rawFields.length}</span>
        </div>
        <div class="compact-cards-grid-2">
          ${fieldsCards || '<div class="empty-state-notice">Nenhum elemento corresponde ao campo selecionado.</div>'}
        </div>
      </div>

      ${flow.length > 0 ? `
        <div class="layer-section-block">
          <div class="section-title-strip">
            <h3 class="section-heading"><i class="fa-solid fa-timeline"></i> Fluxo do usuário</h3>
            <span class="section-count-badge">${flow.length} etapas</span>
          </div>
          <div class="user-flow-vertical-timeline">
            <div class="timeline-line-track"></div>
            ${flow.map((st, i) => {
              const isDec = st.k === "dec";
              return `
                <div class="timeline-step-row ${isDec ? 'is-decision-step' : ''}">
                  <div class="timeline-node-marker">
                    <span class="timeline-node-dot"></span>
                  </div>
                  <div class="timeline-step-card ${isDec ? 'decision-card' : ''}">
                    <div class="timeline-step-text">${st.t || ''}</div>
                    ${isDec && (st.y || st.n) ? `
                      <div class="timeline-decision-branches-row">
                        ${st.y ? `<div class="timeline-branch-item branch-sim"><b>Sim</b> <span>${esc(st.y)}</span></div>` : ''}
                        ${st.n ? `<div class="timeline-branch-item branch-nao"><b>Não</b> <span>${esc(st.n)}</span></div>` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}

      ${states.length > 0 ? `
        <div class="layer-section-block">
          <div class="section-title-strip">
            <h3 class="section-heading"><i class="fa-solid fa-traffic-light"></i> Estados e Feedback da Interface</h3>
          </div>
          <div class="states-compact-grid">
            ${states.map((st) => `
              <div class="state-compact-chip">
                <span class="state-chip-title">${esc(st[0])}</span>
                <span class="state-chip-desc">${esc(st[1])}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${diffs.length > 0 ? `
        <div class="layer-section-block">
          <div class="section-title-strip">
            <h3 class="section-heading"><i class="fa-solid fa-code-compare"></i> Diferenças: Protótipo vs Código Real</h3>
            <span class="section-count-badge">${diffs.length} itens</span>
          </div>
          <div class="table-compact-wrapper">
            <table class="dense-data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Tipo</th>
                  <th>Protótipo</th>
                  <th>Código Real</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                ${diffs.map((d) => `
                  <tr>
                    <td><b>${esc(d.item)}</b></td>
                    <td><span class="type-mini-tag">${esc(d.tipo || "—")}</span></td>
                    <td class="text-muted-cell">${esc(d.proto || "—")}</td>
                    <td class="text-code-cell"><code>${esc(d.code || "—")}</code></td>
                    <td><span class="status-badge status-${d.st}">${esc(d.st)}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Renderiza a Camada 2: Regras de Negócio.
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailRulesLayer(sc) {
  const rawRules = sc.rules || [];
  const rules = filterByFocusedField(rawRules);

  const rulesCards = rules.map((r) => {
    const stMeta = STATUS_MAP[r.st] || STATUS_MAP.ok;

    return `
      <div class="compact-info-card vertical-rule-card">
        <div class="card-compact-head">
          <div class="card-head-title">
            <i class="fa-solid fa-scale-balanced text-primary-accent"></i>
            <b>${esc(r.title)}</b>
          </div>
          <span class="status-badge" style="color:${stMeta.color};background:${stMeta.bg}">
            ${esc(stMeta.label)}
          </span>
        </div>

        <div class="card-compact-body">
          <p class="card-desc-text">${esc(r.t || "Definição operacional de regra de negócio.")}</p>
        </div>

        <div class="card-compact-foot">
          <div class="card-field-chips">
            ${(r.refs || []).map((rf) => `
              <button type="button" class="chip-ref-target ${dls.focusedFieldId === rf ? 'active' : ''}" onclick="setFocusedField('${esc(rf)}')" title="Selecionar campo ${esc(rf)} na tela">
                <i class="fa-solid fa-bullseye"></i> Campo ${esc(rf)}
              </button>
            `).join("")}
          </div>
          ${r.src ? `<span class="card-source-ref" title="${esc(r.src)}"><i class="fa-regular fa-file-lines"></i> <code>${esc(r.src)}</code></span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-scale-balanced"></i> Regras de Negócio da Etapa</h3>
          <span class="section-count-badge">${rules.length} de ${rawRules.length}</span>
        </div>
        <div class="compact-vertical-list">
          ${rulesCards || '<div class="empty-state-notice">Nenhuma regra de negócio associada ao campo selecionado.</div>'}
        </div>
      </div>
    </div>
  `;
}
