// @ts-check
// Estado atual do protótipo, entregue ao agente no início de cada execução.
//
// Por que existe: o modelo só recebia o texto do pedido. Numa etapa 2 ele não sabia que a listagem, o CSS e as chaves de
// storage da etapa 1 já existiam, e reinventava o Design System (telas que não conversam entre si). Como o usuário também
// restaura versões e edita pelo canvas, o estado é lido do disco a CADA execução, nunca da memória da conversa.
const fs = require("fs");
const path = require("path");
const { NAV_RULES, navScreenLine } = require("./atelier-nav-contract.service");
const { buildProtoMap } = require("./atelier-proto-map.service");

const MAX_SCREEN_CHARS = 7000;
const MAX_CSS_CHARS = 9000;
const MAX_TOTAL_CHARS = 45000;
const MAX_FOCUSED_SCREEN_CHARS = 60000;

/** Ids das telas citadas no pedido (ex.: <contexto-elemento arquivo="screens/nova-prescricao.html">): o agente vai editá-las. */
function focusedScreenIds(/** @type {string} */ prompt) {
  const ids = new Set();
  for (const m of String(prompt || "").matchAll(/screens\/([\w.-]+?)\.html/g)) ids.add(m[1]);
  return ids;
}

function readText(/** @type {string} */ file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function clip(/** @type {string} */ text, /** @type {number} */ max) {
  if (text.length <= max) return { text, cut: false };
  return { text: `${text.slice(0, max)}\n<!-- ... cortado: ${text.length - max} caracteres a mais no arquivo ... -->`, cut: true };
}

/** Chaves de localStorage/sessionStorage usadas nas telas: o que as telas compartilham entre si. */
function storageKeys(/** @type {string[]} */ htmls) {
  const keys = new Set();
  for (const html of htmls) {
    for (const m of html.matchAll(/(?:local|session)Storage\s*\.\s*(?:get|set|remove)Item\(\s*["'`]([^"'`]+)["'`]/g)) keys.add(m[1]);
  }
  return [...keys];
}

/**
 * @param {{ projectDir: string, protoId: string, prompt?: string }} ctx
 * @returns {string} bloco de texto para anteceder o pedido; vazio se o protótipo ainda não tem nada
 */
function buildProtoContext({ projectDir, protoId, prompt = "" }) {
  const protoDir = path.join(projectDir, "design", "prototypes", protoId);
  const screensDir = path.join(protoDir, "screens");
  let files = [];
  try {
    files = fs.readdirSync(screensDir).filter((f) => f.endsWith(".html")).sort();
  } catch {
    /* sem telas ainda */
  }
  const css = readText(path.join(protoDir, "styles", "proto.css"));
  if (!files.length && !css.trim()) return "";

  let registered = [];
  let components = [];
  try {
    const manifest = JSON.parse(readText(path.join(protoDir, "proto.json")));
    registered = (manifest.screens || []).map((/** @type {{id:string}} */ s) => s.id);
    components = (manifest.components || []).map((/** @type {{id:string}} */ c) => c.id).filter(Boolean);
  } catch {
    /* proto.json ilegível: segue só com o disco */
  }

  const screens = files.map((f) => ({ id: f.replace(/\.html$/, ""), html: readText(path.join(screensDir, f)) }));
  const parts = [];
  const keys = storageKeys(screens.map((s) => s.html));
  parts.push(buildProtoMap({ protoId, screens, css, registered, storage: keys, components }).text);
  parts.push(`## Estado ATUAL do protótipo "${protoId}" (lido do disco agora)`);
  parts.push(`Telas em disco: ${screens.map((s) => `${s.id} (${s.html.length} caracteres${registered.includes(s.id) ? "" : ", NÃO registrada no proto.json"})`).join(", ") || "nenhuma"}.`);
  if (keys.length) parts.push(`Chaves de storage já usadas pelas telas (REUSE exatamente estas, com o mesmo formato de dado): ${keys.join(", ")}.`);

  let budget = MAX_TOTAL_CHARS;
  const c = clip(css, MAX_CSS_CHARS);
  if (c.text.trim()) {
    parts.push(`### styles/proto.css (este é o Design System vivo: classes, variáveis, componentes)
\`\`\`css
${c.text}
\`\`\``);
    budget -= c.text.length;
  }
  // Telas citadas no pedido vão primeiro e inteiras (só elas serão reescritas); as demais dividem o que sobrar.
  const focus = focusedScreenIds(prompt);
  const ordered = [...screens.filter((s) => focus.has(s.id)), ...screens.filter((s) => !focus.has(s.id))];
  for (const s of ordered) {
    const focused = focus.has(s.id);
    if (!focused && budget <= 0) {
      parts.push(`### screens/${s.id}.html
(omitida por tamanho; ${s.html.length} caracteres)`);
      continue;
    }
    const h = clip(s.html, focused ? MAX_FOCUSED_SCREEN_CHARS : Math.min(MAX_SCREEN_CHARS, budget));
    parts.push(`### screens/${s.id}.html${focused ? " (tela em edição: conteúdo COMPLETO)" : ""}
\`\`\`html
${h.text}
\`\`\``);
    budget -= h.text.length;
  }

  const nav = screens.length ? [`- ${NAV_RULES}`, `- ${navScreenLine(screens.map((s) => s.id))}`] : [];
  parts.push(
    [
      "## Regras para continuar este protótipo",
      "- Isto é uma CONTINUAÇÃO: não recrie o Design System. Use as classes, variáveis CSS, shell/layout, ícones e dados que já existem acima.",
      "- Telas novas devem usar o mesmo vocabulário visual e as mesmas chaves de storage das telas existentes, para que naveguem e compartilhem dados entre si.",
      ...nav,
      "- Só use atelier_patch_styles para ACRESCENTAR o que falta; não redefina classes que já existem.",
      "- Para alterar uma tela existente, reescreva-a por inteiro partindo do conteúdo acima, preservando o que não foi pedido para mudar.",
      "- NÃO esconda elementos de forma fixa (atributo hidden, display:none, is-hidden) a menos que o usuário peça explicitamente; ocultar é estado do Inspetor (botão do olho na árvore de camadas), gravado como data-hidden=\"true\" (e data-locked=\"true\" para o cadeado). Preserve esses atributos ao reescrever uma tela e nunca os crie por conta própria. Atributo hidden só entra quando um script da própria tela o alterna (modal, aviso, aba).",
      "- Se o conteúdo acima divergir do que você lembra da conversa, vale o que está acima (o usuário pode ter restaurado versões ou editado).",
    ].join("\n"),
  );
  return parts.join("\n\n");
}

module.exports = { buildProtoContext, storageKeys, focusedScreenIds };
