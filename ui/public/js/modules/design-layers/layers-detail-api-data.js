// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { STATUS_MAP } from "./layers-state.js";
import { filterByFocusedField } from "./layers-detail-ui-rules.js";

/**
 * Renderiza a Camada 3: API e Serviços.
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailApiLayer(sc) {
  const rawEndpoints = sc.endpoints || [];
  const endpoints = filterByFocusedField(rawEndpoints);
  const chains = sc.chains || [];
  const seqs = sc.seqs || [];

  const epCards = endpoints.map((e) => {
    const stMeta = STATUS_MAP[e.st] || STATUS_MAP.ok;
    const method = (e.m || "GET").toUpperCase();

    return `
      <div class="compact-info-card endpoint-card">
        <div class="card-compact-head">
          <div class="card-head-title">
            <span class="mth-badge mth-${method.toLowerCase()}">${esc(method)}</span>
            <code class="endpoint-route-text">${esc(e.r)}</code>
          </div>
          <span class="status-badge" style="color:${stMeta.color};background:${stMeta.bg}">
            ${esc(stMeta.label)}
          </span>
        </div>

        <div class="endpoint-specs-grid">
          <div class="spec-cell">
            <span class="spec-label">Parâmetros / Entrada:</span>
            <span class="spec-val">${esc(e.p || "—")}</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Resposta / Saída:</span>
            <span class="spec-val">${esc(e.resp || "—")}</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Service Front-end:</span>
            <code class="spec-code">${esc(e.svc || "—")}</code>
          </div>
        </div>

        ${e.refs?.length ? `
          <div class="card-compact-foot">
            <div class="card-field-chips">
              ${e.refs.map((rf) => `
                <button type="button" class="chip-ref-target ${dls.focusedFieldId === rf ? 'active' : ''}" onclick="setFocusedField('${esc(rf)}')" title="Selecionar campo ${esc(rf)} na tela">
                  <i class="fa-solid fa-bullseye"></i> Campo ${esc(rf)}
                </button>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-network-wired"></i> Endpoints REST e Serviços</h3>
          <span class="section-count-badge">${endpoints.length} de ${rawEndpoints.length}</span>
        </div>
        <div class="compact-vertical-list">
          ${epCards || '<div class="empty-state-notice">Nenhum endpoint associado ao campo selecionado.</div>'}
        </div>
      </div>

      <!-- Sequência e Cadeia de Chamadas Arquiteturais (Linhas Verticais Numeradas) -->
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-diagram-project"></i> Sequência de chamadas</h3>
        </div>
        <div class="arch-seq-vertical-box">
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">1</span>
            <div class="arch-seq-content">
              <b>Tela → Serviço Front-end</b>
              <span>Disparo do formulário via serviço Angular (<code>PrescricaoService</code>)</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">2</span>
            <div class="arch-seq-content">
              <b>Serviço → Interceptor</b>
              <span>Injeção de autenticação Bearer JWT e cabeçalhos CNES do operador</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">3</span>
            <div class="arch-seq-content">
              <b>Interceptor → Controller / Resource</b>
              <span>Rotas REST do backend Spring Boot (ex.: <code>PrescricaoResource</code>)</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">4</span>
            <div class="arch-seq-content">
              <b>Controller → Core / Service</b>
              <span>Validações de negócio, cálculo de posologia e regras de dispensação</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">5</span>
            <div class="arch-seq-content">
              <b>Core → Repository</b>
              <span>Interfaces de contrato de dados (ex.: <code>PrescricaoRepository</code>)</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">6</span>
            <div class="arch-seq-content">
              <b>Repository → Infraestrutura</b>
              <span>Mapeamento relacional Hibernate e persistência Spring Data JPA</span>
            </div>
          </div>
          <div class="arch-seq-step-line">
            <span class="arch-seq-num">7</span>
            <div class="arch-seq-content">
              <b>Infraestrutura → Banco ou Externo</b>
              <span>Transações no PostgreSQL e consultas remotas Gercon</span>
            </div>
          </div>
        </div>
      </div>

      ${chains.length > 0 ? `
        <div class="layer-section-block">
          <div class="section-title-strip">
            <h3 class="section-heading"><i class="fa-solid fa-sitemap"></i> Camadas do backend</h3>
          </div>
          <div class="compact-vertical-list">
            ${chains.map((c) => `
              <div class="compact-info-card backend-layer-card">
                <div class="card-compact-head">
                  <code class="endpoint-route-text">${esc(c.ep)}</code>
                </div>
                <div class="backend-layers-stack">
                  ${(c.chain || []).map((node) => `
                    <div class="backend-layer-row">
                      <span class="backend-layer-role">${esc(node[0])}</span>
                      <code class="backend-layer-class">${esc(node[1])}</code>
                    </div>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Renderiza a Camada 4: Dados.
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailDataLayer(sc) {
  const rawEntities = sc.entities || [];
  const entities = filterByFocusedField(rawEntities);
  const map = filterByFocusedField(sc.map || []);

  const entCards = entities.map((ent) => {
    const kindLabel = ent.kind === "tabela" ? "Tabela / Entidade" : ent.kind === "dto" ? "DTO de API" : "Modelo Externo";
    const kindBadgeClass = ent.kind === "tabela" ? "kind-table" : ent.kind === "dto" ? "kind-dto" : "kind-model";

    return `
      <div class="compact-info-card entity-card">
        <div class="card-compact-head">
          <div class="card-head-title">
            <span class="kind-badge ${kindBadgeClass}">${esc(kindLabel)}</span>
            <b class="entity-name-text">${esc(ent.name)}</b>
          </div>
          ${ent.src ? `<span class="card-source-ref"><code>${esc(ent.src)}</code></span>` : ""}
        </div>

        ${ent.cols?.length ? `
          <div class="table-compact-wrapper">
            <table class="dense-data-table">
              <thead>
                <tr>
                  <th>Campo / Coluna</th>
                  <th>Tipo</th>
                  <th>Descrição / Papel</th>
                </tr>
              </thead>
              <tbody>
                ${ent.cols.map((c) => `
                  <tr>
                    <td class="text-code-cell"><code>${esc(c[0])}</code></td>
                    <td><span class="type-mini-tag">${esc(c[1])}</span></td>
                    <td class="text-muted-cell">${esc(c[2] || "")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-database"></i> Entidades de Persistência, DTOs e Modelos</h3>
          <span class="section-count-badge">${entities.length} de ${rawEntities.length}</span>
        </div>
        <div class="compact-vertical-list">
          ${entCards || '<div class="empty-state-notice">Nenhum modelo de dados associado ao campo selecionado.</div>'}
        </div>
      </div>

      ${map.length > 0 ? `
        <div class="layer-section-block">
          <div class="section-title-strip">
            <h3 class="section-heading"><i class="fa-solid fa-link"></i> Mapeamento da Tela até a Coluna do Banco</h3>
            <span class="section-count-badge">${map.length} itens</span>
          </div>
          <div class="table-compact-wrapper">
            <table class="dense-data-table">
              <thead>
                <tr>
                  <th>Campo na Tela</th>
                  <th>Request / DTO</th>
                  <th>Coluna no Banco</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                ${map.map((m) => `
                  <tr>
                    <td><b>${esc(m.f)}</b></td>
                    <td class="text-code-cell"><code>${esc(m.req)}</code></td>
                    <td class="text-code-cell"><code>${esc(m.col)}</code></td>
                    <td><span class="status-badge status-${m.st}">${esc(m.st)}</span></td>
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
