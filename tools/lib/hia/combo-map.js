// @ts-check
// Mapa tarefa SDLC -> combo do 9Router. Funcoes puras: classificam o prompt por palavras-chave e
// sugerem o combo (modo fallback, gratuitos primeiro). A sugestao e informativa: quem aplica e o chamador.
// Os combos de experimento (fusion e smart) ficam fora do mapa e so entram por escolha explicita.

const PROVIDER = "9router";
// The old all-purpose "Harness" combo was deleted from 9Router; general prompts stay on the default model.
const GENERAL_COMBO = "harness-implementacao";

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
/** @type {Array<[string, RegExp]>} */
const RULES = [
  ["diagram", /mermaid|diagrama|\bc4\b|\buml\b|\berd\b|fluxograma|mapa mental/],
  ["test", /\btestes?\b|\bjest\b|junit|cobertura|unit test|\btdd\b|test case/],
  ["review", /\breview\b|revis[aã]o|code review|\bpr\b|\bdiff\b|vulnerab|seguran[cç]a do c[oó]digo/],
  ["refactor", /refator|refactor|renomei|reorganiz|extrair m[eé]todo/],
  ["investigate", new RegExp([
    /\bbugs?\b|exception|stack ?trace|causa raiz|root cause|investig|\bcrash\b|\berros?\b|\berrors?\b|falha/.source,
    // Pasted compiler/terminal errors and "it does not work" reports.
    /\bproblem\b|\bproblemas?\b|fix it|cannot be|is not assignable|is missing|unterminated|\bwarn(ing)?\b/.source,
    /n[aã]o (est[aá] |esta )?(funciona|aparece|sobe|carrega|consig)|n[aã]o (est[aá]|esta) (funcionando|aparecendo|subindo|carregando)/.source,
  ].join("|"))],
  ["docs", /readme|documenta|changelog|javadoc|jsdoc/],
  ["design", /prot[oó]tipo|\bux\b|design system|wireframe|\bcss\b|\blayout\b|\btela\b/],
  ["orchestrate", /orquestr|delegu?e|delegar|subagente/],
  ["loop", /\bloop\b|itere|iterar|repita at[eé]/],
  ["research", /pesquis|compar(e|a[cç][aã]o)|biblioteca|research|benchmark/],
  ["plan", /arquitetur|planej|decompon|roadmap|plano de|\badrs?\b/],
  ["implement", new RegExp([
    /implement|\bcrie\b|\bcriar\b|desenvolv|adicione|endpoint|componente|\bsql\b|\bquery\b/.source,
    // Change requests: "ajuste", "substituir", "alterar", "atualize", "configurar", "disponibilizar".
    /\bajust|substitu|\balter[ae]|\batualiz|configur|disponibiliz|inclus[aã]o de|\bincluir\b/.source,
  ].join("|"))],
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
