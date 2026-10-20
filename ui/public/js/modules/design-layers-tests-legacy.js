// @ts-check
// Camadas Testes e Legado, e despacho da camada ativa.
import { esc } from "../shared/dom.js";
import { dls } from "./design-layers-store.js";
import { makeFilterRefs, renderUiLayer, renderRulesLayer } from "./design-layers-ui-rules.js";
import { renderApiLayer, renderDataLayer } from "./design-layers-api-data.js";

/** Camada Testes & Cobertura. */
export function renderTestsLayer(sc) {
  const tests = sc.tests || { groups: [], nota: "" };
  const groups = tests.groups || [];

  const testGroupsHtml = groups.map((g) => `
    <div class="layer-item-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <code>${esc(g.ep)}</code>
        <span class="audit-tag tag-${g.st}">${esc(g.st?.toUpperCase() || 'TEST')}</span>
      </div>
      <div style="font-size:11px;color:var(--mute);margin-bottom:6px">Fonte: <code>${esc(g.src || '')}</code> · ${g.cases?.length || 0} cenários</div>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text)">
        ${(g.cases || []).map((c) => `<li><b>${esc(c[1] || '')}</b>: ${esc(c[0] || '')}</li>`).join('')}
      </ul>
    </div>
  `).join("");

  return `
    <div>
      <h4 class="layer-sub-heading">Cenários de Testes Automatizados da Tela (${groups.length} grupos de endpoints)</h4>
      <div style="display:flex;flex-direction:column;gap:10px">${testGroupsHtml || '<div style="color:var(--mute);padding:12px">Nenhum cenário de teste cadastrado nesta tela.</div>'}</div>
      ${tests.nota ? `<div style="font-size:11.5px;color:var(--mute);margin-top:10px">Nota: ${esc(tests.nota)}</div>` : ''}
    </div>
  `;
}

/** Camada Legado & Paridade. */
export function renderLegacyLayer(sc) {
  const filterRefs = makeFilterRefs();
  const rawLegacy = sc.legacy || [];
  const legacy = filterRefs(rawLegacy);

  const legCards = legacy.map((it) => `
    <div class="audit-legacy-card ${it.pm ? 'has-pm-warning' : ''}">
      <div class="legacy-card-head">
        <b>${esc(it.title)}</b>
        <div>
          ${it.pm ? '<span class="audit-tag tag-pm">⚠️ SEM DECISÃO PM</span> ' : ''}
          <span class="audit-tag tag-${it.par}">${esc(it.par)}</span>
        </div>
      </div>
      <div class="legacy-comparison-grid">
        <div class="legacy-col">
          <span class="legacy-col-label">Legado:</span>
          <div class="legacy-col-text">${esc(it.legado || '')}</div>
        </div>
        <div class="legacy-col">
          <span class="legacy-col-label">Novo Sistema:</span>
          <div class="legacy-col-text">${esc(it.novo || '')}</div>
        </div>
      </div>
      <div class="legacy-why"><b>${it.par === 'igual' ? 'Observação:' : 'Por quê:'}</b> ${esc(it.porque || '')}</div>
      ${it.fonte ? `<div style="font-size:11px;color:var(--mute);margin-top:4px">Fonte: <code>${esc(it.fonte)}</code></div>` : ''}
    </div>
  `).join("");

  return `
    <div>
      <h4 class="layer-sub-heading">Paridade com o Sistema Legado (${legacy.length} itens comparados)</h4>
      <div style="display:flex;flex-direction:column;gap:10px">${legCards || '<div style="color:var(--mute);padding:12px">Nenhum item do legado corresponde ao filtro.</div>'}</div>
    </div>
  `;
}

/**
 * Renderiza o conteúdo da camada ativa.
 * @param {any} sc
 */
export function renderActiveLayerContent(sc) {
  if (!sc) return '<div style="padding:24px;text-align:center;color:var(--mute)">Nenhuma tela selecionada.</div>';
  switch (dls.activeLayer) {
    case "ui": return renderUiLayer(sc);
    case "rules": return renderRulesLayer(sc);
    case "api": return renderApiLayer(sc);
    case "data": return renderDataLayer(sc);
    case "tests": return renderTestsLayer(sc);
    case "legacy": return renderLegacyLayer(sc);
    default: return "";
  }
}
