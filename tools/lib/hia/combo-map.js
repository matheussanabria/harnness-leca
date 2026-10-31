// @ts-check
// Mapa tarefa SDLC -> combo do 9Router. Funcoes puras: classificam o prompt por palavras-chave e
// sugerem o combo (modo fallback, gratuitos primeiro). A sugestao e informativa: quem aplica e o chamador.
// Os combos de experimento (fusion e smart) ficam fora do mapa e so entram por escolha explicita.

const PROVIDER = "9router";
const GENERAL_COMBO = "Harness";

/** Tipo de tarefa -> nome do combo no 9Router. */
const COMBO_BY_TYPE = Object.freeze({
  plan: "harness-planejamento",
  investigate: "harness-bugs",
  research: "harness-pesquisa",
  implement: "harness-implementacao",
  refactor: "harness-refatoracao",
  review: "harness-review",
  test: "harness-testes",
  docs: "harness-documentacao",
  diagram: "harness-diagramas",
  design: "harness-design",
  loop: "harness-loop",
  orchestrate: "harness-orquestracao",
  general: GENERAL_COMBO,
});

// A ordem importa: tipos mais especificos primeiro; "implement" e o ultimo recurso antes de "general".
const RULES = [
  ["diagram", /mermaid|diagrama|\bc4\b|\buml\b|\berd\b|fluxograma|mapa mental/],
  ["test", /\btestes?\b|\bjest\b|junit|cobertura|unit test|\btdd\b|test case/],
  ["review", /\breview\b|revis[aã]o|code review|\bpr\b|\bdiff\b|vulnerab|seguran[cç]a do c[oó]digo/],
  ["refactor", /refator|refactor|renomei|reorganiz|extrair m[eé]todo/],
  ["investigate", /\bbugs?\b|exception|stack ?trace|causa raiz|root cause|investig|\bcrash\b|\berro\b|falha/],
  ["docs", /readme|documenta|changelog|javadoc|jsdoc/],
  ["design", /prot[oó]tipo|\bux\b|design system|wireframe|\bcss\b|\blayout\b|\btela\b/],
  ["orchestrate", /orquestr|delegu?e|delegar|subagente/],
  ["loop", /\bloop\b|itere|iterar|repita at[eé]/],
  ["research", /pesquis|compar(e|a[cç][aã]o)|biblioteca|research|benchmark/],
  ["plan", /arquitetur|planej|decompon|roadmap|plano de|\badrs?\b/],
  ["implement", /implement|\bcrie\b|\bcriar\b|desenvolv|adicione|endpoint|componente|\bsql\b|\bquery\b/],
];

/**
 * Classifica o prompt em um tipo de tarefa SDLC.
 * @param {string} prompt
 * @returns {keyof typeof COMBO_BY_TYPE}
 */
function classifyTask(prompt) {
  const text = String(prompt || "").toLowerCase();
  for (const [type, re] of RULES) {
    if (re.test(text)) return /** @type {keyof typeof COMBO_BY_TYPE} */ (type);
  }
  return "general";
}

/**
 * Sugere o combo para o prompt.
 * @param {string} prompt
 * @returns {{type: string, combo: string, modelRef: string, source: "keyword"|"default"}}
 */
function suggestCombo(prompt) {
  const type = classifyTask(prompt);
  const combo = COMBO_BY_TYPE[type];
  return { type, combo, modelRef: `${PROVIDER}/${combo}`, source: type === "general" ? "default" : "keyword" };
}

module.exports = { COMBO_BY_TYPE, GENERAL_COMBO, classifyTask, suggestCombo };
