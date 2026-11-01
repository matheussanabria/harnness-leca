// @ts-check
// Contrato de navegação compartilhado pelos três caminhos de geração do Ateliê (EP-16.03).
// Sem ele o modelo copia o caminho screens/<id>.html do contexto para o href e o preview responde 404.
const NAV_RULES = `Navigation contract: to go to another screen use <a href="#" data-action="goto:<screen-id>">. Never use href for files (screens/x.html, x.html) nor goto: inside href. <screen-id> is the file name without .html. A link to a screen that does not exist yet must use the ID that will be created.`;

/**
 * Lista os IDs de tela válidos para o contrato, sem alterar o argumento.
 * @param {string[]} ids
 * @returns {string}
 */
function navScreenLine(ids) {
  const list = Array.isArray(ids) ? ids : [];
  return list.length ? `Valid screen IDs: ${list.join(", ")}.` : "Valid screen IDs: none yet.";
}

module.exports = { NAV_RULES, navScreenLine };
