// @ts-check
// Line parsers for the documents the reference index points into. Every parser splits on /\r?\n/ and never
// relies on "." matching "\r", so CRLF files read the same as LF ones (see fix f171fba in story-features).
// Anchors follow fixed conventions shared with the client reader (docs-render.js): rnAnchor and criterionAnchor.

const RN_ID = /RN-[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}/i;
const TEXT_MAX = 200;
/** Trace ids are the two-space-indented uppercase keys of rastreio.yml (CD-01, PS-31, CA-443-6, T1-01). */
const TRACE_KEY = /^ {2}([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[a-z]?):/;

/** @param {string} text */
const lines = (text) => String(text || "").replace(/^﻿/, "").split(/\r?\n/);

/** @param {string} id */
const rnAnchor = (id) => id.toLowerCase();
/** @param {string|number} n */
const criterionAnchor = (n) => `criterio-${n}`;

/** Plain text of a Markdown cell or line: no emphasis, code ticks or links. @param {string} md */
function plain(md) {
  return String(md || "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} text @param {number} max */
function clip(text, max = TEXT_MAX) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Rules defined as table rows whose first cell is the id: "| RN-calculo-dispensacao-001 | text | code |".
 * @param {string} text regras.md content
 * @returns {{ id: string, line: number, text: string }[]}
 */
function parseRules(text) {
  const out = [];
  lines(text).forEach((line, i) => {
    if (!line.trimStart().startsWith("|")) return;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const id = plain(cells[0] || "").match(new RegExp(`^${RN_ID.source}$`, "i"));
    if (!id) return;
    out.push({ id: id[0], line: i + 1, text: clip(plain(cells[1] || "")) });
  });
  return out;
}

/**
 * Title (first "# " heading) and acceptance criteria ("- **Critério 3:** ...") of a user-story.md.
 * @param {string} text
 * @returns {{ title: string, criteria: Record<string, { line: number, text: string }> }}
 */
function parseStory(text) {
  let title = "";
  /** @type {Record<string, { line: number, text: string }>} */
  const criteria = {};
  lines(text).forEach((line, i) => {
    if (!title) {
      const h = line.match(/^#\s+(\S[^\r\n]*)$/);
      if (h) title = plain(h[1]);
    }
    const c = line.match(/^\s*(?:[-*+]|\d+[.)])?\s*\**\s*Crit[ée]rio\s+(\d+)\s*[:.)-]?\s*\**\s*:?\s*([^\r\n]*)$/i);
    if (c && !criteria[c[1]]) criteria[c[1]] = { line: i + 1, text: clip(plain(c[2])) };
  });
  return { title, criteria };
}

/**
 * Trace entries of a rastreio.yml: id, line and title (inline "titulo:" or on the next lines).
 * @param {string} text
 * @returns {{ id: string, line: number, title: string }[]}
 */
function parseTrace(text) {
  const all = lines(text);
  const out = [];
  all.forEach((line, i) => {
    const m = line.match(TRACE_KEY);
    if (!m || /^RN-/i.test(m[1])) return;
    let title = "";
    const inline = line.match(/titulo:\s*"([^"]*)"/);
    if (inline) title = inline[1];
    for (let j = i + 1; !title && j < all.length && /^ {4}/.test(all[j]); j += 1) {
      const t = all[j].match(/^ {4}titulo:\s*"?([^"\r\n]*)"?\s*$/);
      if (t) title = t[1];
    }
    out.push({ id: m[1], line: i + 1, title: clip(plain(title)) });
  });
  return out;
}

/**
 * Placeholder ids that became a numbered story: rows of the table under a heading that mentions "Apelidos"
 * ("| `DIS-NOVA-PRESCRICAO` | **DIS-505** | ..."). Returns { placeholder: number }.
 * @param {string} text _historias.md content
 * @returns {Record<string, string>}
 */
function parseAliases(text) {
  /** @type {Record<string, string>} */
  const aliases = {};
  let inSection = false;
  for (const line of lines(text)) {
    const h = line.match(/^#{1,6}\s+([^\r\n]*)$/);
    if (h) {
      inSection = /apelido|alias/i.test(h[1]);
      continue;
    }
    if (!inSection || !line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => plain(c));
    const from = (cells[0] || "").match(/^[A-Z]+-[A-Z0-9-]+$/);
    const to = (cells[1] || "").match(/[A-Z]+-\d+/);
    if (from && to && from[0] !== to[0]) aliases[from[0]] = to[0];
  }
  return aliases;
}

/**
 * Frontmatter scalar ("status: rascunho") read without a YAML dependency.
 * @param {string} text @param {string} key
 */
function frontmatterValue(text, key) {
  const block = String(text || "").match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return "";
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}:\\s*([^\\r\\n]*)$`));
    if (m) return m[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return "";
}

module.exports = { parseRules, parseStory, parseTrace, parseAliases, frontmatterValue, plain, rnAnchor, criterionAnchor, RN_ID };
