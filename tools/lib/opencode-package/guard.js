// @ts-check
// Confere se os arquivos alterados pelo agente cabem na lista permitida da história.

/** "ui/**" -> qualquer coisa abaixo; "x/*.js" -> um nível; sem curinga -> igual ou prefixo de pasta. */
function patternToRegExp(pattern) {
  const p = pattern.replace(/\\/g, "/").replace(/\/+$/, "");
  const esc = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${esc}(/.*)?$`);
}

/** @param {string[]} changed caminhos relativos @param {string[]} allowed padrões @returns {string[]} violações */
function findViolations(changed, allowed) {
  const rules = allowed.map(patternToRegExp);
  return changed.map((f) => f.replace(/\\/g, "/")).filter((f) => !rules.some((re) => re.test(f)));
}

module.exports = { patternToRegExp, findViolations };
