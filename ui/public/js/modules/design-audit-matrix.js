// @ts-check
// Scorecards e matriz de regras da auditoria.
import { esc } from "../shared/dom.js";
import { das } from "./design-audit-store.js";

/**
 * Renderiza o scorecard de resumo no topo da Auditoria.
 * @param {any} scorecards
 */
export function renderScorecards(scorecards = {}) {
  const cov = scorecards.rulesCoveragePercent ?? 100;
  const leg = scorecards.legacyParityPercent ?? 100;
  const arch = scorecards.architecturalScore ?? 100;
  const ds = scorecards.designSystemScore ?? 100;

  const getColor = (pct) => (pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444");

  return `
    <div class="audit-scorecards-grid">
      <div class="audit-scorecard">
        <div class="scorecard-top">
          <span class="scorecard-title"><i class="fa-solid fa-flask"></i> Cobertura de Regras</span>
          <span class="scorecard-badge" style="background:${getColor(cov)}20;color:${getColor(cov)}">${cov}%</span>
        </div>
        <div class="scorecard-value">${scorecards.coveredRules || 0} <span class="scorecard-sub">/ ${scorecards.totalRules || 0} regras</span></div>
        <div class="scorecard-progress-bar">
          <div class="scorecard-progress-fill" style="width:${cov}%;background:${getColor(cov)}"></div>
        </div>
        <div class="scorecard-foot">
          <span>${scorecards.uncoveredRulesCount || 0} regra(s) sem cenário</span>
        </div>
      </div>

      <div class="audit-scorecard">
        <div class="scorecard-top">
          <span class="scorecard-title"><i class="fa-solid fa-landmark"></i> Paridade com Legado</span>
          <span class="scorecard-badge" style="background:${getColor(leg)}20;color:${getColor(leg)}">${leg}%</span>
        </div>
        <div class="scorecard-value">${(scorecards.legacyCounts?.igual || 0) + (scorecards.legacyCounts?.dif || 0)} <span class="scorecard-sub">/ ${scorecards.totalLegacy || 0} itens</span></div>
        <div class="scorecard-progress-bar">
          <div class="scorecard-progress-fill" style="width:${leg}%;background:${getColor(leg)}"></div>
        </div>
        <div class="scorecard-foot">
          <span>${scorecards.legacyCounts?.semDecisaoPm || 0} sem decisão do PM</span>
        </div>
      </div>

      <div class="audit-scorecard">
        <div class="scorecard-top">
          <span class="scorecard-title"><i class="fa-solid fa-building"></i> Conformidade Arquitetural</span>
          <span class="scorecard-badge" style="background:${getColor(arch)}20;color:${getColor(arch)}">${arch}%</span>
        </div>
        <div class="scorecard-value">Clean Arch <span class="scorecard-sub">Core isolado</span></div>
        <div class="scorecard-progress-bar">
          <div class="scorecard-progress-fill" style="width:${arch}%;background:${getColor(arch)}"></div>
        </div>
        <div class="scorecard-foot">
          <span>Checkstyle & ProblemDetail RFC 7807</span>
        </div>
      </div>

      <div class="audit-scorecard">
        <div class="scorecard-top">
          <span class="scorecard-title"><i class="fa-solid fa-pen-ruler"></i> Aderência Design System</span>
          <span class="scorecard-badge" style="background:${getColor(ds)}20;color:${getColor(ds)}">${ds}%</span>
        </div>
        <div class="scorecard-value">Design System <span class="scorecard-sub">Tokens & UI</span></div>
        <div class="scorecard-progress-bar">
          <div class="scorecard-progress-fill" style="width:${ds}%;background:${getColor(ds)}"></div>
        </div>
        <div class="scorecard-foot">
          <span>Componentes reutilizáveis</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza a matriz de regras versus testes.
 * @param {any[]} rules
 */
export function renderRulesMatrix(rules = []) {
  let filtered = rules;

  if (das.auditFilterMode === "covered") {
    filtered = filtered.filter((r) => r.testStatus !== "none");
  } else if (das.auditFilterMode === "uncovered") {
    filtered = filtered.filter((r) => r.testStatus === "none");
  }

  if (das.auditSearchQuery) {
    const q = das.auditSearchQuery.toLowerCase();
    filtered = filtered.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.telaNome.toLowerCase().includes(q) ||
      (r.t && r.t.toLowerCase().includes(q)) ||
      (r.testLocation && r.testLocation.toLowerCase().includes(q))
    );
  }

  const badgeForTest = (st) => {
    switch (st) {
      case "auto":
      case "unit":
        return `<span class="audit-tag tag-auto"><i class="fa-solid fa-check"></i> ${esc(st.toUpperCase())}</span>`;
      case "bdd":
        return `<span class="audit-tag tag-bdd"><i class="fa-solid fa-check"></i> BDD</span>`;
      case "req":
        return `<span class="audit-tag tag-req"><i class="fa-solid fa-check"></i> REQ/API</span>`;
      case "viz":
        return `<span class="audit-tag tag-viz"><i class="fa-solid fa-eye"></i> VISUAL</span>`;
      default:
        return `<span class="audit-tag tag-none"><i class="fa-solid fa-xmark"></i> SEM CENÁRIO</span>`;
    }
  };

  const rows = filtered.map((r, i) => `
    <tr class="${r.testStatus === 'none' ? 'rule-uncovered' : ''}">
      <td style="color:var(--mute);font-size:11px;width:35px">${i + 1}</td>
      <td style="font-weight:600;min-width:180px">
        <div style="font-size:11px;color:#a5b4fc;margin-bottom:2px">${esc(r.telaNome)}</div>
        <div style="font-size:13px">${esc(r.title)}</div>
        ${r.t ? `<div style="font-size:11.5px;color:var(--mute);margin-top:3px">${esc(r.t)}</div>` : ''}
      </td>
      <td style="width:130px;text-align:center">${badgeForTest(r.testStatus)}</td>
      <td style="font-size:11.5px;color:var(--mute);min-width:200px">
        <code>${esc(r.testLocation || 'Sem arquivo vinculado')}</code>
      </td>
      <td style="width:110px;text-align:right">
        <button type="button" class="btn-card-action" onclick="copyRuleTestPrompt('${esc(r.title)}', '${esc(r.telaNome)}')" title="Copiar prompt para o Agente gerar o teste">
          <i class="fa-solid fa-flask"></i> Gerar Teste
        </button>
      </td>
    </tr>
  `).join("");

  return `
    <div class="audit-panel-box">
      <div class="audit-panel-header">
        <div>
          <h3 style="margin:0;font-size:15px;color:var(--text)">Matriz de Regras de Negócio e Testes (${filtered.length} de ${rules.length})</h3>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">Para cada regra: onde mora o cenário que a exercita e se está coberta por testes automatizados.</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="text" class="chats-search-input" style="width:200px" placeholder="Filtrar regra..." value="${esc(das.auditSearchQuery)}" oninput="onAuditSearchInput(this.value)">
          <div class="view-mode-toggle">
            <button type="button" class="view-btn ${das.auditFilterMode === 'all' ? 'active' : ''}" onclick="setAuditRulesFilter('all')">Todas</button>
            <button type="button" class="view-btn ${das.auditFilterMode === 'uncovered' ? 'active' : ''}" onclick="setAuditRulesFilter('uncovered')">Sem Cenário</button>
            <button type="button" class="view-btn ${das.auditFilterMode === 'covered' ? 'active' : ''}" onclick="setAuditRulesFilter('covered')">Cobertas</button>
          </div>
        </div>
      </div>

      <div style="overflow-x:auto;max-height:480px">
        <table class="audit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Regra e Tela</th>
              <th style="text-align:center">Situação do Teste</th>
              <th>Localização / Cenário</th>
              <th style="text-align:right">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--mute)">Nenhuma regra encontrada com o filtro selecionado.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
