// @ts-check
// Pure rule sensors: no process, no file. They look at the answer text or at one code block.
const { findSecrets } = require("../../redact");

/** @typedef {{ sensor: string, severity: "error" | "warning", line: number, message: string }} Finding */

// The project forbids emojis in UI and code (FontAwesome icons only). Dingbats and pictographs, not symbols such as
// the copyright sign or arrows.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u;
const EMOJI_LANGS = new Set(["js", "jsx", "ts", "tsx", "css", "html", "java", "python", "sql", "json", "xml", "shell"]);
const TEST_LANGS = new Set(["js", "jsx", "ts", "tsx", "java", "python"]);
const LOOKS_LIKE_TEST = /\b(describe|it|test)\s*\(|@Test\b|\bdef test_|\bunittest\b|\bpytest\b/;
const ASSERTION = /\b(expect|assert\w*|should|verify|toBe\w*|toEqual|toThrow|assertEquals|assertThat|assertTrue|assertThrows)\b/;
const MERMAID_START = /^(sequenceDiagram|flowchart|graph|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline|quadrantChart|requirementDiagram|C4\w*|block-beta|xychart-beta|sankey-beta)\b/;

/** @param {string} text @returns {Finding[]} */
function secretsRule(text) {
  return findSecrets(text).slice(0, 3).map((s) => ({ sensor: "secret", severity: "error", line: s.line, message: `possible secret in the answer (${s.rule}); the value is not shown` }));
}

/** @param {{ lang: string, code: string }} block @returns {Finding[]} */
function emojiRule({ lang, code }) {
  if (!EMOJI_LANGS.has(lang)) return [];
  const idx = code.split("\n").findIndex((l) => EMOJI.test(l));
  return idx < 0 ? [] : [{ sensor: "emoji", severity: "warning", line: idx + 1, message: "emoji in code (project rule: FontAwesome icons only)" }];
}

/** @param {{ lang: string, code: string }} block @returns {Finding[]} */
function testRule({ lang, code }) {
  if (!TEST_LANGS.has(lang) || !LOOKS_LIKE_TEST.test(code) || ASSERTION.test(code)) return [];
  return [{ sensor: "tests", severity: "warning", line: 1, message: "test code without any assertion" }];
}

/** @param {{ lang: string, code: string }} block @returns {Finding[]} */
function mermaidRule({ lang, code }) {
  if (lang !== "mermaid") return [];
  const lines = code.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("%%"));
  const first = lines[0] || "";
  if (!MERMAID_START.test(first)) return [{ sensor: "mermaid", severity: "warning", line: 1, message: "does not start with a known Mermaid diagram type" }];
  const body = lines.join("\n").replace(/"[^"\n]*"/g, "");
  for (const [open, close] of [["[", "]"], ["(", ")"], ["{", "}"]]) {
    if (body.split(open).length !== body.split(close).length) return [{ sensor: "mermaid", severity: "warning", line: 1, message: `unbalanced ${open}${close} in the diagram` }];
  }
  return [];
}

/** @param {boolean} unclosedFence @returns {Finding[]} */
function fenceRule(unclosedFence) {
  return unclosedFence ? [{ sensor: "truncated", severity: "warning", line: 1, message: "the answer ends inside an unclosed code block" }] : [];
}

module.exports = { secretsRule, emojiRule, testRule, mermaidRule, fenceRule };
