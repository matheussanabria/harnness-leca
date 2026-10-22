// @ts-check
// Cruzamento entre o Quadro de Componentes e a matriz de auditoria (EP-11.03).
const { buildDesignIndex } = require("../design-index.service");
const { buildAuditMatrix } = require("./audit-matrix.service");

const MIN_TOKEN = 5;
const SITUATIONS = Object.freeze(["sem_regra", "regra_sem_evidencia", "regra_em_execucao", "regra_aprovada"]);
const STATE_PRIORITY = Object.freeze({ planned: 0, generated: 1, executed: 2, approved: 3 });

/**
 * Normaliza um texto em tokens comparaveis.
 * @param {string} value
 * @returns {string[]}
 */
function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_TOKEN);
}

/**
 * Tokens de um componente: identificador, nome, seletor e classe.
 * @param {any} component
 * @returns {string[]}
 */
function componentTokens(component) {
  const raw = [component?.id, component?.name, component?.selector, component?.className, component?.tag]
    .filter(Boolean)
    .join(" ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return [...new Set(tokens(raw))];
}

/**
 * Tokens de uma regra: titulo, tela e origem.
 * @param {any} row
 * @returns {string[]}
 */
function ruleTokens(row) {
  return [...new Set(tokens([row?.title, row?.screenName, row?.detail].filter(Boolean).join(" ")))];
}

/**
 * Verifica se componente e regra compartilham algum token.
 * @param {string[]} componentParts
 * @param {string[]} ruleParts
 * @returns {boolean}
 */
function sharesToken(componentParts, ruleParts) {
  const ruleSet = new Set(ruleParts);
  return componentParts.some((token) => ruleSet.has(token));
}

/**
 * Situacao de auditoria de um componente, dado o pior estado das regras vinculadas.
 * @param {any[]} rules
 * @returns {string}
 */
function situationFor(rules = []) {
  if (!rules.length) return "sem_regra";
  let worst = "planned";
  for (const rule of rules) {
    if ((STATE_PRIORITY[rule.state] ?? 0) > (STATE_PRIORITY[worst] ?? 0)) worst = rule.state;
  }
  if (worst === "approved") return "regra_aprovada";
  if (worst === "executed") return "regra_em_execucao";
  return "regra_sem_evidencia";
}

/**
 * Monta o cruzamento entre componentes e regras de auditoria.
 * @param {{ slug: string, repoRoot: string, projectDir: string }} params
 * @returns {Object}
 */
function buildComponentAudit({ slug, repoRoot, projectDir }) {
  const index = buildDesignIndex(projectDir, repoRoot);
  const matrix = buildAuditMatrix({ slug, repoRoot, projectDir });
  const components = (index.components || []).map((component) => {
    const parts = componentTokens(component);
    const rules = (matrix.matrix || []).filter((row) => sharesToken(parts, ruleTokens(row)));
    return {
      id: component.id || component.className || component.name || "",
      name: component.name || component.className || component.id || "",
      selector: component.selector || "",
      stage: component.stage || "prototype",
      checklist: component.checklist || {},
      files: component.files || null,
      situation: situationFor(rules),
      audit: {
        total: rules.length,
        counts: {
          planned: rules.filter((rule) => rule.state === "planned").length,
          generated: rules.filter((rule) => rule.state === "generated").length,
          executed: rules.filter((rule) => rule.state === "executed").length,
          approved: rules.filter((rule) => rule.state === "approved").length,
        },
        rules: rules.map((rule) => ({
          screenId: rule.screenId,
          ruleTitle: rule.title,
          state: rule.state,
          file: rule.evidence?.file || "",
        })),
      },
    };
  });

  const linked = new Set();
  for (const component of components) {
    for (const rule of component.audit.rules) linked.add(`${rule.screenId}|${rule.ruleTitle}`);
  }
  const orphanRules = (matrix.matrix || [])
    .filter((row) => !linked.has(`${row.screenId}|${row.title}`))
    .map((row) => ({ screenId: row.screenId, ruleTitle: row.title, state: row.state }));

  return {
    ok: true,
    slug,
    components,
    rulesWithoutComponent: orphanRules,
    situations: SITUATIONS,
    totals: {
      components: components.length,
      withRules: components.filter((item) => item.audit.total > 0).length,
      approved: components.filter((item) => item.situation === "regra_aprovada").length,
      withoutRules: components.filter((item) => item.situation === "sem_regra").length,
      orphanRules: orphanRules.length,
    },
    warnings: matrix.warnings || [],
  };
}

module.exports = {
  MIN_TOKEN,
  SITUATIONS,
  STATE_PRIORITY,
  tokens,
  componentTokens,
  ruleTokens,
  sharesToken,
  situationFor,
  buildComponentAudit,
};
