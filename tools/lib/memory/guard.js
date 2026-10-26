const { FORMAT_RULES, SECRET_RULES, PII_RULES } = require("../redact");

/**
 * Padrão adicional para CNS (Cartão Nacional de Saúde: 15 dígitos começando com 1, 2, 7, 8 ou 9).
 */
const CNS_RULE = [/\b[12789]\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, "[REDIGIDO:cns]", "CNS"];

/**
 * Regras estritas aplicadas na validação de itens de memória antes de gravar.
 * @type {Array<[RegExp, string]>}
 */
const GUARD_RULES = [
  ...FORMAT_RULES.map(([re, , name]) => /** @type {[RegExp, string]} */ ([re, name || "segredo"])),
  [SECRET_RULES[SECRET_RULES.length - 1][0], "atribuição de segredo ou senha"],
  [PII_RULES[0][0], "e-mail"],
  [PII_RULES[1][0], "CPF"],
  [PII_RULES[2][0], "CPF rotulado"],
  [PII_RULES[3][0], "telefone"],
  [PII_RULES[4][0], "telefone"],
  [PII_RULES[5][0], "telefone"],
  [PII_RULES[6][0], "telefone"],
  [CNS_RULE[0], "CNS"],
];

/**
 * Inspeciona description e corpo procurando qualquer segredo ou dado pessoal.
 * Devolve lista de violações identificadas por nome (sem expor o valor).
 * @param {string} description
 * @param {string} body
 * @returns {string[]} Nomes das categorias de segredos encontradas
 */
function inspectSecrets(description, body) {
  const combined = `${description || ""}\n${body || ""}`;
  /** @type {Set<string>} */
  const violations = new Set();

  for (const [re, name] of GUARD_RULES) {
    // Clona o regex para resetar estado de global search
    const matcher = new RegExp(re.source, re.flags);
    if (matcher.test(combined)) {
      violations.add(name);
    }
  }

  return Array.from(violations);
}

module.exports = {
  inspectSecrets,
  GUARD_RULES,
};
