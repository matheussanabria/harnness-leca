// @ts-check
// Realce de sintaxe local e sem dependências para o editor do Studio.

const SCRIPT_KEYWORDS = new Set((
  "abstract as async await break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface keyof let new null of override package private protected public readonly return set static super switch this throw true try type typeof undefined var void while with yield"
).split(" "));

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function token(className, value) {
  return `<span class="syntax-${className}">${escapeHtml(value)}</span>`;
}

function scan(code, pattern, classify) {
  let output = "";
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    output += escapeHtml(code.slice(cursor, match.index));
    output += token(classify(match[0], match.index, code), match[0]);
    cursor = match.index + match[0].length;
  }
  return output + escapeHtml(code.slice(cursor));
}

function highlightScript(code) {
  const pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[A-Za-z_$][\w$]*|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b/g;
  return scan(code, pattern, (value) => {
    if (value.startsWith("//") || value.startsWith("/*")) return "comment";
    if (/^[`"']/.test(value)) return "string";
    if (value.startsWith("@")) return "decorator";
    if (/^\d/.test(value)) return "number";
    if (SCRIPT_KEYWORDS.has(value)) return "keyword";
    if (/^[A-Z]/.test(value)) return "type";
    return "identifier";
  });
}

function highlightAttributes(value) {
  const pattern = /([:@*#\[\]()\w.-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
  let output = "";
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    output += escapeHtml(value.slice(cursor, match.index));
    output += token("attribute", match[1]) + escapeHtml(match[2]) + token("string", match[3]);
    cursor = match.index + match[0].length;
  }
  return output + escapeHtml(value.slice(cursor));
}

function highlightHtml(code) {
  const pattern = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;
  let output = "";
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    output += escapeHtml(code.slice(cursor, match.index));
    const value = match[0];
    if (value.startsWith("<!--")) output += token("comment", value);
    else {
      const tag = value.match(/^(<\/?)([\w:-]+)([\s\S]*?)(\/?>)$/);
      output += tag
        ? token("punctuation", tag[1]) + token("tag", tag[2]) + highlightAttributes(tag[3]) + token("punctuation", tag[4])
        : escapeHtml(value);
    }
    cursor = match.index + value.length;
  }
  return output + escapeHtml(code.slice(cursor));
}

function highlightCss(code) {
  const pattern = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[\da-fA-F]{3,8}\b|@[\w-]+|(?:--[\w-]+|[A-Za-z][\w-]*)(?=\s*:)|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg)?\b/g;
  return scan(code, pattern, (value) => {
    if (value.startsWith("/*")) return "comment";
    if (/^["']/.test(value)) return "string";
    if (value.startsWith("@")) return "keyword";
    if (value.startsWith("#")) return "color";
    if (/^\d/.test(value)) return "number";
    return "property";
  });
}

function highlightData(code) {
  const pattern = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b|#[^\n]*/g;
  return scan(code, pattern, (value, index, source) => {
    if (value.startsWith("#")) return "comment";
    if (/^["']/.test(value)) {
      return /^\s*:/.test(source.slice(index + value.length)) ? "property" : "string";
    }
    if (/^-?\d/.test(value)) return "number";
    return "keyword";
  });
}

function highlightMarkdown(code) {
  const pattern = /^#{1,6} .+$|`{1,3}[^`]*`{1,3}|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/gm;
  return scan(code, pattern, (value) => value.startsWith("#") ? "keyword" : value.startsWith("[") ? "link" : "string");
}

export function sourceLanguage(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "txt";
  if (["ts", "tsx"].includes(ext)) return "TypeScript";
  if (["js", "jsx", "mjs"].includes(ext)) return "JavaScript";
  if (["html", "xml", "vue", "svelte"].includes(ext)) return "HTML";
  if (["css", "scss", "sass", "less"].includes(ext)) return ext.toUpperCase();
  if (["json", "yaml", "yml"].includes(ext)) return ext.toUpperCase();
  if (["java", "kt"].includes(ext)) return ext === "kt" ? "Kotlin" : "Java";
  if (ext === "md") return "Markdown";
  return ext.toUpperCase();
}

export function highlightSourceCode(code, filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  if (["html", "xml", "vue", "svelte"].includes(ext)) return highlightHtml(code);
  if (["css", "scss", "sass", "less"].includes(ext)) return highlightCss(code);
  if (["json", "yaml", "yml"].includes(ext)) return highlightData(code);
  if (ext === "md") return highlightMarkdown(code);
  if (["ts", "tsx", "js", "jsx", "mjs", "java", "kt", "py", "go", "rs"].includes(ext)) return highlightScript(code);
  return escapeHtml(code);
}
