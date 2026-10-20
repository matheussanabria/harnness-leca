// @ts-check
// Camadas UI/UX e Regras de Negócio.
import { esc } from "../shared/dom.js";
import { dls } from "./design-layers-store.js";

/** Filtra itens pela referência do campo em foco (quando o filtro está ativo). */
export function makeFilterRefs() {
  return (items) => {
    if (!dls.filterOnlyFocused || !dls.focusedFieldId) return items;
    return items.filter((it) => {
      if (Array.isArray(it.refs)) return it.refs.includes(dls.focusedFieldId);
      if (it.id === dls.focusedFieldId) return true;
      return false;
    });
  };
}

/** Camada UI / UX. */
export function renderUiLayer(sc) {
  const filterRefs = makeFilterRefs();
  const rawFields = sc.fields || [];
  const fields = filterRefs(rawFields);
  const flow = sc.flow || [];
  const diffs = sc.diffs || [];

  const fieldsCards = fields.map((f) => `
    <div class="layer-field-card ${dls.focusedFieldId === f.id ? 'selected' : ''}" onclick="setFocusedField('${esc(f.id)}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="field-badge-num">${esc(f.n || f.id)}</span>
          <b>${esc(f.label || f.id)}</b>
        </div>
        <span class="audit-tag tag-${f.ui?.st || 'ok'}">${esc(f.ui?.st || 'ok')}</span>
      </div>
      <div style="font-size:12px;color:var(--text);margin-bottom:6px">${esc(f.ui?.t || '')}</div>
      ${f.ui?.c ? `<div style="font-family:monospace;font-size:11px;color:#a5b4fc">🧩 &lt;${esc(f.ui.c)}&gt;</div>` : ''}
    </div>
  `).join("");

  const flowSteps = flow.map((n, i) => `
    <div class="flow-step-node node-${n.k || 'act'}">
      <span class="flow-step-num">${i + 1}</span>
      <span class="flow-step-text">${esc(n.t || '')}</span>
    </div>
  `).join('<span style="color:var(--mute)">→</span>');

  const diffRows = diffs.map((d) => `
    <tr>
      <td><b>${esc(d.item)}</b></td>
      <td>${esc(d.tipo || '—')}</td>
      <td style="color:var(--mute)">${esc(d.proto || '—')}</td>
      <td style="font-family:monospace;color:#a5b4fc">${esc(d.code || '—')}</td>
      <td><span class="audit-tag tag-${d.st}">${esc(d.st)}</span></td>
    </tr>
  `).join("");

  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <h4 class="layer-sub-heading">Elementos e Campos da Tela (${fields.length} itens)</h4>
        <div class="layer-fields-grid">${fieldsCards || '<div style="color:var(--mute);padding:12px">Nenhum campo corresponde ao filtro.</div>'}</div>
      </div>

      ${flow.length > 0 ? `
        <div>
          <h4 class="layer-sub-heading">Fluxo do Usuário</h4>
          <div class="flow-container">${flowSteps}</div>
        </div>
      ` : ''}

      ${diffs.length > 0 ? `
        <div>
          <h4 class="layer-sub-heading">Conferência Visual: Código Real vs Protótipo (${diffs.length} verificações)</h4>
          <table class="audit-table">
            <thead>
              <tr>
                <th>Item Verificado</th>
                <th>Tipo</th>
                <th>Protótipo</th>
                <th>Código Real</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>${diffRows}</tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}

/** Camada Regras de Negócio. */
export function renderRulesLayer(sc) {
  const filterRefs = makeFilterRefs();
  const rawRules = sc.rules || [];
  const rules = filterRefs(rawRules);

  const rulesCards = rules.map((r) => `
    <div class="layer-item-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <b>${esc(r.title)}</b>
        <span class="audit-tag tag-${r.st || 'ok'}">${esc(r.st || 'ok')}</span>
      </div>
      <div style="font-size:12.5px;color:var(--text);margin-bottom:8px">${esc(r.t || '')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px">
        <div style="display:flex;gap:4px">
          ${(r.refs || []).map((rf) => `<button type="button" class="chip-ref" onclick="setFocusedField('${esc(rf)}')">🎯 Campo ${esc(rf)}</button>`).join('')}
        </div>
        ${r.src ? `<span style="color:var(--mute)">Fonte: <code>${esc(r.src)}</code></span>` : ''}
      </div>
    </div>
  `).join("");

  return `
    <div>
      <h4 class="layer-sub-heading">Regras de Negócio da Tela (${rules.length} regras)</h4>
      <div style="display:flex;flex-direction:column;gap:10px">${rulesCards || '<div style="color:var(--mute);padding:12px">Nenhuma regra corresponde ao filtro.</div>'}</div>
    </div>
  `;
}
