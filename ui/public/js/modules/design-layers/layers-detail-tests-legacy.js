// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { LEGACY_PARITY_MAP } from "./layers-state.js";
import { filterByFocusedField } from "./layers-detail-ui-rules.js";

/**
 * Renderiza a Camada 5: Testes e BDD.
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailTestsLayer(sc) {
  const tests = sc.tests || { groups: [], nota: "" };
  const rawGroups = tests.groups || [];
  const groups = filterByFocusedField(rawGroups);
  const rawRules = sc.rules || [];
  const rules = filterByFocusedField(rawRules);

  // Mapear regras para seus respectivos endpoints e status de teste
  const ruleRows = rules.map((r) => {
    const coveringGroup = rawGroups.find((g) => (g.rules || []).some((gr) => gr.toLowerCase() === r.title.toLowerCase()));
    let testStatus = "Sem automação";
    let testBadgeClass = "test-status-doc";
    let epLabel = "Validação no Front";

    if (coveringGroup) {
      epLabel = coveringGroup.ep || "API";
      if (coveringGroup.st === "auto") {
        testStatus = "Automação Verificada";
        testBadgeClass = "test-status-auto";
      } else if (coveringGroup.st === "req" || /postman/i.test(coveringGroup.src || "")) {
        testStatus = "Postman (sem asserção)";
        testBadgeClass = "test-status-postman";
      } else {
        testStatus = "Cenário Documentado";
      }
    }

    return `
      <tr>
        <td><b>${esc(r.title)}</b></td>
        <td><span class="status-badge status-${r.st}">${esc(r.st)}</span></td>
        <td><span class="test-kind-badge ${testBadgeClass}">${esc(testStatus)}</span></td>
        <td class="text-code-cell"><code>${esc(epLabel)}</code></td>
      </tr>
    `;
  }).join("");

  // B. Cenários por endpoint em accordions compactos
  const epAccordions = groups.map((g) => {
    const isPostmanOnly = g.st === "req" || /postman/i.test(g.src || "");
    const isAutoVerified = g.st === "auto";
    const statusLabel = isAutoVerified ? "Automação Verificada" : isPostmanOnly ? "Postman (Sem asserção)" : "Documentado sem Automação";
    const statusClass = isAutoVerified ? "test-status-auto" : isPostmanOnly ? "test-status-postman" : "test-status-doc";
    const parts = (g.ep || "").split(" ");
    const method = parts.length > 1 ? parts[0] : "GET";
    const route = parts.length > 1 ? parts.slice(1).join(" ") : g.ep;

    return `
      <details class="endpoint-test-accordion">
        <summary class="endpoint-accordion-summary">
          <div class="ep-acc-left">
            <span class="mth-badge mth-${method.toLowerCase()}">${esc(method)}</span>
            <code class="endpoint-route-text">${esc(route)}</code>
          </div>
          <div class="ep-acc-right">
            <span class="test-kind-badge ${statusClass}">${esc(statusLabel)}</span>
            <span class="ep-cases-count"><i class="fa-solid fa-list-check"></i> ${g.cases?.length || 0} cenários</span>
            <i class="fa-solid fa-chevron-down ep-chevron-icon"></i>
          </div>
        </summary>
        <div class="endpoint-accordion-body">
          ${g.cases?.length ? `
            <div class="table-compact-wrapper">
              <table class="dense-data-table">
                <thead>
                  <tr>
                    <th>Cenário de Teste</th>
                    <th style="width:120px;">Tipo / Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  ${g.cases.map((c) => `
                    <tr>
                      <td>${esc(c[0] || "")}</td>
                      <td><span class="type-mini-tag">${esc(c[1] || "geral")}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state-notice">Nenhum caso detalhado registrado.</div>'}
        </div>
      </details>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <!-- Seção A: Cobertura das Regras -->
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-clipboard-check"></i> Cobertura das regras da tela</h3>
          <span class="section-count-badge">${rules.length} de ${rawRules.length}</span>
        </div>
        <div class="table-compact-wrapper">
          <table class="dense-data-table">
            <thead>
              <tr>
                <th>Regra</th>
                <th>Situação</th>
                <th>Teste</th>
                <th>Endpoint / Origem</th>
              </tr>
            </thead>
            <tbody>
              ${ruleRows || '<tr><td colspan="4" class="empty-state-notice">Nenhuma regra encontrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Seção B: Cenários por Endpoint (Accordions compactos) -->
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-vial"></i> Cenários por endpoint</h3>
          <span class="section-count-badge">${groups.length} endpoints</span>
        </div>
        <div class="compact-vertical-list">
          ${epAccordions || '<div class="empty-state-notice">Nenhum endpoint de teste associado ao campo selecionado.</div>'}
        </div>
      </div>

      ${tests.nota ? `
        <div class="test-audit-warning-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <b>Nota de auditoria de testes:</b> ${esc(tests.nota)}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Renderiza a Camada 6: Legado (Comparação Lado a Lado).
 * @param {any} sc
 * @returns {string}
 */
export function renderDetailLegacyLayer(sc) {
  const rawLegacy = sc.legacy || [];
  const legacy = filterByFocusedField(rawLegacy);

  const legacyCards = legacy.map((it) => {
    const parity = LEGACY_PARITY_MAP[it.par] || LEGACY_PARITY_MAP.igual;

    return `
      <div class="compact-info-card legacy-comparison-card ${it.pm ? 'has-pm-flag' : ''}">
        <div class="card-compact-head">
          <div class="card-head-title">
            <i class="fa-solid fa-clock-rotate-left text-primary-accent"></i>
            <b>${esc(it.title)}</b>
          </div>
          <div class="legacy-badges-wrap">
            ${it.pm ? `
              <span class="pm-alert-pill" title="Aguardando validação ou definição de Product Manager">
                <i class="fa-solid fa-user-shield"></i> Decisão PM Aberta
              </span>
            ` : ""}
            <span class="parity-pill" style="color:${parity.color};border-color:${parity.color}">
              ${esc(parity.label)}
            </span>
          </div>
        </div>

        <!-- Comparação Lado a Lado: LEGADO vs NOVO SISTEMA -->
        <div class="side-by-side-grid">
          <div class="side-col side-legacy">
            <div class="side-col-header">
              <span class="side-badge legacy-side-badge">LEGADO</span>
            </div>
            <div class="side-col-content">
              ${esc(it.legado || "Sem comportamento documentado no sistema anterior.")}
            </div>
          </div>

          <div class="side-col side-novo">
            <div class="side-col-header">
              <span class="side-badge novo-side-badge">NOVO SISTEMA</span>
            </div>
            <div class="side-col-content">
              ${esc(it.novo || "Comportamento idêntico ou ainda não especificado.")}
            </div>
          </div>
        </div>

        <div class="legacy-justification-strip">
          <b>${it.par === 'igual' ? 'Observação:' : 'Justificativa da diferença:'}</b>
          <span>${esc(it.porque || "Paridade mantida conforme diretriz do projeto.")}</span>
        </div>

        <div class="card-compact-foot">
          <div class="card-field-chips">
            ${(it.refs || []).map((rf) => `
              <button type="button" class="chip-ref-target ${dls.focusedFieldId === rf ? 'active' : ''}" onclick="setFocusedField('${esc(rf)}')" title="Selecionar campo ${esc(rf)} na tela">
                <i class="fa-solid fa-bullseye"></i> Campo ${esc(rf)}
              </button>
            `).join("")}
          </div>
          ${it.fonte ? `<span class="card-source-ref">Fonte: <code>${esc(it.fonte)}</code></span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="layer-section-container">
      <div class="layer-section-block">
        <div class="section-title-strip">
          <h3 class="section-heading"><i class="fa-solid fa-code-compare"></i> Paridade Lado a Lado: Sistema Legado vs Novo</h3>
          <span class="section-count-badge">${legacy.length} de ${rawLegacy.length}</span>
        </div>
        <div class="compact-vertical-list">
          ${legacyCards || '<div class="empty-state-notice">Nenhum comparativo do legado associado ao campo selecionado.</div>'}
        </div>
      </div>
    </div>
  `;
}
