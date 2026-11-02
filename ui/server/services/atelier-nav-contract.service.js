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

/**
 * Screen IDs a screen links to via data-action="goto:<id>", in first-seen order, without duplicates.
 * @param {string} html
 * @returns {string[]}
 */
function extractNavTargets(html) {
  const out = new Set();
  for (const m of String(html || "").matchAll(/data-action\s*=\s*["']goto:([^"'\s]+)["']/g)) out.add(m[1]);
  return [...out];
}

/**
 * Compact navigation graph for the prototype map: one "from>to,to" entry per screen that links somewhere.
 * Targets that are not valid screen IDs are reported separately so the agent can fix or create them.
 * @param {Array<{ id: string, html: string }>} screens
 * @returns {{ edges: string, broken: string }}
 */
function navGraph(screens) {
  const ids = new Set(screens.map((s) => s.id));
  const edges = [];
  const broken = [];
  for (const s of screens) {
    const targets = extractNavTargets(s.html);
    if (targets.length) edges.push(`${s.id}>${targets.join(",")}`);
    for (const t of targets) if (!ids.has(t)) broken.push(`${s.id}>${t}`);
  }
  return { edges: edges.join("; "), broken: broken.join("; ") };
}

module.exports = { NAV_RULES, navScreenLine, extractNavTargets, navGraph };
