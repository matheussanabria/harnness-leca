// @ts-check
const path = require("path");

const ALLOWED_EXTS = new Set([".html", ".htm", ".css", ".js", ".json", ".md"]);
const MAX_FILE_SIZE = 500 * 1024; // 500 KB por arquivo

/**
 * Valida se um caminho de arquivo é seguro e está estritamente contido no diretório base do protótipo.
 * @param {string} protoDir
 * @param {string} relPath
 * @returns {{ ok: boolean, error?: string, normalizedPath?: string }}
 */
function validatePrototypePath(protoDir, relPath) {
  if (!relPath || typeof relPath !== "string") {
    return { ok: false, error: "Caminho do arquivo não informado." };
  }
  if (relPath.includes("\0")) {
    return { ok: false, error: "Caminho contém caracteres nulos proibidos." };
  }

  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return { ok: false, error: "Tentativa de evasão de diretório (..) proibida." };
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return { ok: false, error: `Extensão '${ext}' não permitida no protótipo.` };
  }

  const resolved = path.resolve(protoDir, normalized);
  const rel = path.relative(path.resolve(protoDir), resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: "Caminho fora da pasta do protótipo." };
  }

  return { ok: true, normalizedPath: normalized };
}

/**
 * Remove tags perigosas, URIs maliciosas e handlers de eventos inline de fragmentos HTML.
 * @param {string} html
 * @returns {string}
 */
function sanitizeHtmlFragment(html) {
  if (!html || typeof html !== "string") return "";

  let cleaned = html;

  // 1. Remove tags potencialmente perigosas e que quebram sandbox
  cleaned = cleaned.replace(/<\s*(?:iframe|object|embed|applet|meta|base)[^>]*>.*?<\/\s*(?:iframe|object|embed|applet|meta|base)\s*>/gis, "");
  cleaned = cleaned.replace(/<\s*(?:iframe|object|embed|applet|meta|base)[^>]*\/?>/gis, "");

  // 2. Remove tags script com src externo (HTTP/HTTPS/protocol relative)
  cleaned = cleaned.replace(/<\s*script[^>]*src\s*=\s*['"]?(?:https?:|\/\/)[^>]*>.*?<\/\s*script\s*>/gis, "");
  cleaned = cleaned.replace(/<\s*script[^>]*src\s*=\s*['"]?(?:https?:|\/\/)[^>]*\/?>/gis, "");

  // 3. Remove handlers de evento inline (onclick, onload, onerror, etc.)
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 4. Remove URIs javascript:, vbscript: e data:text/html em atributos href, src, action
  cleaned = cleaned.replace(/(href|src|action)\s*=\s*['"]\s*(?:javascript:|vbscript:|data:(?:text\/html|application\/xhtml\+xml))[^'"]*['"]/gi, '$1="#"');
  cleaned = cleaned.replace(/(href|src|action)\s*=\s*(?:javascript:|vbscript:|data:(?:text\/html|application\/xhtml\+xml))[^\s>]*/gi, '$1="#"');

  // 5. Formulários são legítimos em protótipos (campos, botões): mantém o conteúdo e só
  // impede o envio real (action/method/target removidos, submit bloqueado).
  cleaned = cleaned.replace(/<\s*form\b([^>]*)>/gi, (_m, attrs) => {
    const safe = attrs.replace(/\s+(?:action|method|target|enctype)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return `<form${safe} onsubmit="return false">`;
  });

  return cleaned;
}

/**
 * Analisa o HTML e injeta atributos estáveis data-pid nos nós que ainda não possuem.
 * O data-pid é determinístico com base no índice do nó e tag.
 * @param {string} html
 * @returns {string}
 */
function injectDataPidAttributes(html) {
  if (!html || typeof html !== "string") return "";

  let counter = 0;
  // Expressão regular tolerante que localiza tags de abertura HTML
  return html.replace(/<([a-zA-Z0-9_-]+)([^>]*?)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (["br", "hr", "wbr", "img", "input"].includes(lowerTag)) {
      // Tags void / auto-fecháveis: se já tem data-pid mantém, senão adiciona
      if (/data-pid\s*=/i.test(attrs)) return match;
      counter++;
      const isSelfClosing = attrs.trim().endsWith("/");
      const cleanAttrs = isSelfClosing ? attrs.trim().slice(0, -1).trim() : attrs;
      return `<${tag} ${cleanAttrs} data-pid="p-${counter}"${isSelfClosing ? " /" : ""}>`;
    }

    if (/data-pid\s*=/i.test(attrs)) {
      return match;
    }

    counter++;
    return `<${tag}${attrs ? " " + attrs.trim() : ""} data-pid="p-${counter}">`;
  });
}

/**
 * Extrai blocos delimitados <arquivo caminho="...">...</arquivo> da resposta da LLM.
 * @param {string} text
 * @returns {Array<{ path: string, content: string }>}
 */
function parseDelimitedFiles(text) {
  if (!text || typeof text !== "string") return [];

  const files = [];
  const regex = /<\s*arquivo\s+caminho\s*=\s*["']([^"']+)["']\s*>(.*?)<\/\s*arquivo\s*>/gis;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rawPath = match[1].trim();
    let content = match[2];
    // Se o conteúdo estiver envelopado em bloco markdown ```html ... ``` remove
    content = content.replace(/^\s*```[a-zA-Z0-9_-]*\r?\n/, "").replace(/\r?\n```\s*$/, "");
    files.push({ path: rawPath, content });
  }

  return files;
}

module.exports = {
  validatePrototypePath,
  sanitizeHtmlFragment,
  injectDataPidAttributes,
  parseDelimitedFiles,
  MAX_FILE_SIZE,
};
