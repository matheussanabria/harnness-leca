// @ts-check
// Redacao de dados pessoais nas saidas do Jira.
// O projeto DIS e de saude: comentarios de issue citam CPF, CNS, telefone e e-mail de pacientes.
// A saida do script pode ir para um modelo externo (opencodefree), entao o padrao e redigir.
// A regra e oposta: o script nao tem rede nem token, mas o CONTEUDO que ele imprime e dado sensivel.

// Cada regra: rotulo do marcador e um padrao global. A ordem importa (o mais especifico primeiro).
const RULES = [
  { label: "[CPF]", pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  { label: "[CPF]", pattern: /(?<![\d.])\d{11}(?![\d.])/g },
  { label: "[CNS]", pattern: /(?<![\d.])\d{15}(?![\d.])/g },
  { label: "[e-mail]", pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g },
  { label: "[telefone]", pattern: /(?<!\d)\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}(?!\d)/g },
  { label: "[data de nascimento]", pattern: /\bnascid[oa]\s+em\s+\d{1,2}\/\d{1,2}\/\d{4}\b/gi },
  { label: "[data de nascimento]", pattern: /\bdata\s+de\s+nascimento[:\s]+\d{1,2}\/\d{1,2}\/\d{4}\b/gi },
];

/**
 * Redige dados pessoais de um texto.
 * @param {string} text
 * @param {{ raw?: boolean }} [options] raw=true devolve o texto sem redactions (uso local).
 * @returns {string}
 */
function redact(text, options = {}) {
  const value = String(text == null ? "" : text);
  if (options.raw) return value;
  let out = value;
  for (const rule of RULES) out = out.replace(rule.pattern, rule.label);
  return out;
}

/**
 * Redige recursivamente qualquer valor JSON (strings, objetos, listas).
 * @param {any} value
 * @param {{ raw?: boolean }} [options]
 * @returns {any}
 */
function redactDeep(value, options = {}) {
  if (typeof value === "string") return redact(value, options);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, options));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = redactDeep(item, options);
    return out;
  }
  return value;
}

/** Conta quantas redações seriam aplicadas (as regras rodam em sequência, como na redação). */
function countRedactions(text) {
  let out = String(text || "");
  let total = 0;
  for (const rule of RULES) {
    const matches = out.match(rule.pattern);
    if (matches) total += matches.length;
    out = out.replace(rule.pattern, rule.label);
  }
  return total;
}

module.exports = { redact, redactDeep, countRedactions, RULES };
