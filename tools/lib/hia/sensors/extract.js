// @ts-check
// Pulls fenced code blocks out of a chat answer and normalizes their language tag.

/** @typedef {{ lang: string, code: string, line: number }} Block */

const ALIASES = {
  js: "js", javascript: "js", mjs: "js", cjs: "js", node: "js",
  jsx: "jsx", ts: "ts", typescript: "ts", tsx: "tsx",
  json: "json", jsonc: "json", css: "css", scss: "css",
  py: "python", python: "python", java: "java", sql: "sql",
  mermaid: "mermaid", html: "html", xml: "xml", sh: "shell", bash: "shell", shell: "shell", powershell: "shell", ps1: "shell",
};

/** @param {string} tag */
const normalizeLang = (tag) => ALIASES[/** @type {keyof typeof ALIASES} */ (String(tag || "").toLowerCase())] || String(tag || "").toLowerCase();

const FENCE = /^(`{3,}|~{3,})[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm;

/**
 * @param {string} text
 * @returns {{ blocks: Block[], unclosedFence: boolean }}
 */
function extractBlocks(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  /** @type {Block[]} */
  const blocks = [];
  for (const m of source.matchAll(FENCE)) {
    const before = source.slice(0, m.index);
    blocks.push({ lang: normalizeLang(m[2]), code: m[3], line: before.split("\n").length + 1 });
  }
  // A fence opener left over after the closed blocks are removed means the answer ended inside a code block.
  const rest = source.replace(FENCE, "");
  return { blocks, unclosedFence: /^(`{3,}|~{3,})/m.test(rest) };
}

module.exports = { extractBlocks, normalizeLang };
