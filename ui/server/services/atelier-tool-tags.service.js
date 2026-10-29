// @ts-check
// Interpreta as tags <tool name="..."> que os modelos emitem no texto (opencode e modelos sem tool-use nativo).
//
// Por que existe: HTML e CSS grandes quase nunca cabem num JSON válido (quebras de linha cruas, aspas). Descartar a tag
// em silêncio faz o modelo achar que gravou e finalizar com a tela vazia. Então:
//  - atelier_write_screen e atelier_patch_styles aceitam o conteúdo BRUTO no corpo da tag (sem JSON, sem escapes);
//  - o JSON ainda é aceito, com reparo de quebras de linha/tabs dentro das strings;
//  - o que não der para ler vira um erro devolvido ao modelo, que reenvia.

const TAG = /<\s*(?:tool|ferramenta)\s+(?:name|nome)\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/\s*(?:tool|ferramenta)\s*>/gi;

/** Ferramentas cujo corpo pode ser o conteúdo cru; os atributos da tag trazem o resto. */
const RAW_BODY = {
  atelier_write_screen: (/** @type {Record<string,string>} */ a, /** @type {string} */ body) => ({ screenId: a.screenid || a.screen || a.id || "home", htmlContent: body }),
  atelier_patch_styles: (/** @type {Record<string,string>} */ a, /** @type {string} */ body) => ({ cssContent: body, mode: a.mode || "append" }),
};

function parseAttrs(/** @type {string} */ s) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const m of s.matchAll(/([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  return out;
}

/** Tira o invólucro ```lang ... ``` que alguns modelos põem em volta do conteúdo. */
function stripFence(/** @type {string} */ body) {
  return body.replace(/^\s*```[a-zA-Z0-9_-]*\r?\n/, "").replace(/\r?\n```\s*$/, "").trim();
}

/** Escapa quebras de linha, retornos e tabs que aparecem DENTRO de strings JSON (o erro mais comum dos modelos). */
function escapeControlCharsInStrings(/** @type {string} */ json) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

function parseJsonLenient(/** @type {string} */ body) {
  try { return JSON.parse(body); } catch { /* tenta reparar */ }
  return JSON.parse(escapeControlCharsInStrings(body));
}

/**
 * @param {string} rawText
 * @returns {{ text: string, toolCalls: Array<{ name: string, args: object }>, errors: Array<{ tool: string, reason: string }> }}
 */
function parseToolTags(rawText) {
  if (!rawText || typeof rawText !== "string") return { text: "", toolCalls: [], errors: [] };
  const toolCalls = [];
  const errors = [];
  let found = false;
  const text = rawText.replace(TAG, (_all, name, attrStr, rawBody) => {
    found = true;
    const tool = String(name).trim();
    const attrs = parseAttrs(attrStr || "");
    const body = stripFence(rawBody);
    const raw = RAW_BODY[/** @type {keyof typeof RAW_BODY} */ (tool)];
    if (raw && !body.startsWith("{")) {
      toolCalls.push({ name: tool, args: raw(attrs, body) });
      return "";
    }
    try {
      toolCalls.push({ name: tool, args: parseJsonLenient(body) });
    } catch (err) {
      errors.push({ tool, reason: /** @type {Error} */ (err).message });
    }
    return "";
  });
  return { text: found ? text.trim() : rawText, toolCalls, errors };
}

module.exports = { parseToolTags, escapeControlCharsInStrings };
