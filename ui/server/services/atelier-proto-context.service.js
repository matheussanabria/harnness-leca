// @ts-check
// Estado atual do protótipo, entregue ao agente no início de cada execução.
//
// Por que existe: o modelo só recebia o texto do pedido. Numa etapa 2 ele não sabia que a listagem, o CSS e as chaves de
// storage da etapa 1 já existiam, e reinventava o Design System (telas que não conversam entre si). Como o usuário também
// restaura versões e edita pelo canvas, o estado é lido do disco a CADA execução, nunca da memória da conversa.
const fs = require("fs");
const path = require("path");

const MAX_SCREEN_CHARS = 7000;
const MAX_CSS_CHARS = 9000;
const MAX_TOTAL_CHARS = 45000;

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
 * @param {{ projectDir: string, protoId: string }} ctx
 * @returns {string} bloco de texto para anteceder o pedido; vazio se o protótipo ainda não tem nada
 */
function buildProtoContext({ projectDir, protoId }) {
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
  try {
    registered = (JSON.parse(readText(path.join(protoDir, "proto.json"))).screens || []).map((/** @type {{id:string}} */ s) => s.id);
  } catch {
    /* proto.json ilegível: segue só com o disco */
  }

  const screens = files.map((f) => ({ id: f.replace(/\.html$/, ""), html: readText(path.join(screensDir, f)) }));
  const parts = [];
  parts.push(`## Estado ATUAL do protótipo "${protoId}" (lido do disco agora)`);
  parts.push(`Telas em disco: ${screens.map((s) => `${s.id} (${s.html.length} caracteres${registered.includes(s.id) ? "" : ", NÃO registrada no proto.json"})`).join(", ") || "nenhuma"}.`);
  const keys = storageKeys(screens.map((s) => s.html));
  if (keys.length) parts.push(`Chaves de storage já usadas pelas telas (REUSE exatamente estas, com o mesmo formato de dado): ${keys.join(", ")}.`);

  let budget = MAX_TOTAL_CHARS;
  const c = clip(css, MAX_CSS_CHARS);
  if (c.text.trim()) {
    parts.push(`### styles/proto.css (este é o Design System vivo: classes, variáveis, componentes)\n\`\`\`css\n${c.text}\n\`\`\``);
    budget -= c.text.length;
  }
  for (const s of screens) {
    if (budget <= 0) {
      parts.push(`### screens/${s.id}.html\n(omitida por tamanho; ${s.html.length} caracteres)`);
      continue;
    }
    const h = clip(s.html, Math.min(MAX_SCREEN_CHARS, budget));
    parts.push(`### screens/${s.id}.html\n\`\`\`html\n${h.text}\n\`\`\``);
    budget -= h.text.length;
  }

  parts.push(
    [
      "## Regras para continuar este protótipo",
      "- Isto é uma CONTINUAÇÃO: não recrie o Design System. Use as classes, variáveis CSS, shell/layout, ícones e dados que já existem acima.",
      "- Telas novas devem usar o mesmo vocabulário visual e as mesmas chaves de storage das telas existentes, para que naveguem e compartilhem dados entre si.",
      "- Só use atelier_patch_styles para ACRESCENTAR o que falta; não redefina classes que já existem.",
      "- Para alterar uma tela existente, reescreva-a por inteiro partindo do conteúdo acima, preservando o que não foi pedido para mudar.",
      "- Se o conteúdo acima divergir do que você lembra da conversa, vale o que está acima (o usuário pode ter restaurado versões ou editado).",
    ].join("\n"),
  );
  return parts.join("\n\n");
}

module.exports = { buildProtoContext, storageKeys };
