// @ts-check
// Camadas API & Serviços e Dados & Entidades.
import { esc } from "../shared/dom.js";
import { makeFilterRefs } from "./design-layers-ui-rules.js";

/** Camada API & Serviços. */
export function renderApiLayer(sc) {
  const filterRefs = makeFilterRefs();
  const rawEndpoints = sc.endpoints || [];
  const endpoints = filterRefs(rawEndpoints);
  const seqs = sc.seqs || [];
  const chains = sc.chains || [];

  const epCards = endpoints.map((e) => `
    <div class="layer-item-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="mth-badge mth-${(e.m || 'GET').toLowerCase()}">${esc(e.m || 'GET')}</span>
          <code style="font-size:13px;font-weight:600">${esc(e.r)}</code>
        </div>
        <span class="audit-tag tag-${e.st || 'ok'}">${esc(e.st || 'ok')}</span>
      </div>
      <div class="endpoint-details-grid">
        <div><span style="color:var(--mute)">Entrada:</span> ${esc(e.p || '—')}</div>
        <div><span style="color:var(--mute)">Saída:</span> ${esc(e.resp || '—')}</div>
        <div><span style="color:var(--mute)">Service:</span> <code>${esc(e.svc || '—')}</code></div>
      </div>
    </div>
  `).join("");

  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <h4 class="layer-sub-heading">Endpoints e Chamadas REST (${endpoints.length} rotas)</h4>
        <div style="display:flex;flex-direction:column;gap:10px">${epCards || '<div style="color:var(--mute);padding:12px">Nenhum endpoint corresponde ao filtro.</div>'}</div>
      </div>

      ${chains.length > 0 ? `
        <div>
          <h4 class="layer-sub-heading">Cadeia Clean Architecture (Controller → Core → Infra)</h4>
          ${chains.map((c) => `
            <div class="chain-box">
              <div style="font-weight:600;margin-bottom:6px"><code>${esc(c.ep)}</code></div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                ${(c.chain || []).map((st) => `<span class="chain-node"><b>${esc(st[0])}</b>: ${esc(st[1])}</span>`).join('<span style="color:var(--mute)">→</span>')}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/** Camada Dados & Entidades. */
export function renderDataLayer(sc) {
  const filterRefs = makeFilterRefs();
  const rawEntities = sc.entities || [];
  const entities = filterRefs(rawEntities);
  const map = sc.map || [];

  const entCards = entities.map((ent) => `
    <div class="layer-item-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div>
          <span class="audit-tag tag-auto">${esc(ent.kind || 'tabela')}</span>
          <b style="font-size:14px;margin-left:6px">${esc(ent.name)}</b>
        </div>
        <span style="font-size:11px;color:var(--mute)">${esc(ent.src || '')}</span>
      </div>
      ${ent.cols ? `
        <table class="audit-table mini" style="margin-top:6px">
          <thead><tr><th>Coluna / Campo</th><th>Tipo</th><th>Descrição</th></tr></thead>
          <tbody>
            ${ent.cols.map((c) => `<tr><td><code>${esc(c[0])}</code></td><td>${esc(c[1])}</td><td style="color:var(--mute)">${esc(c[2] || '')}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `).join("");

  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <h4 class="layer-sub-heading">Entidades de Domínio, Tabelas e DTOs (${entities.length} modelos)</h4>
        <div style="display:flex;flex-direction:column;gap:10px">${entCards || '<div style="color:var(--mute);padding:12px">Nenhuma entidade corresponde ao filtro.</div>'}</div>
      </div>

      ${map.length > 0 ? `
        <div>
          <h4 class="layer-sub-heading">Mapeamento Ponta a Ponta: Campo → DTO → Coluna</h4>
          <table class="audit-table">
            <thead><tr><th>Campo da Tela</th><th>Request / DTO</th><th>Coluna do Banco</th><th>Situação</th></tr></thead>
            <tbody>
              ${map.map((m) => `<tr><td><b>${esc(m.f)}</b></td><td><code>${esc(m.req)}</code></td><td><code>${esc(m.col)}</code></td><td><span class="audit-tag tag-${m.st}">${esc(m.st)}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}
