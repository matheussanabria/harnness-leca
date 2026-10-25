// @ts-check
"use strict";
const vm = require("vm");

/**
 * Reader for Design System files in the ".dc.html" format: the component catalogue is a class field
 * `DOCS = [ { id, name, states, desc, html, css, ng, react }, ... ]` inside a script block, not `window.DOCS`.
 *
 * Trust: the array literal is evaluated with `vm` in a context without globals. That keeps accidental access out
 * but `vm` is not a security boundary, so only import files you wrote or trust.
 */

const MARKER = /^\s*DOCS\s*=\s*\[/m;

/** Returns the index just past the `]` that closes the array opened at `open`, honouring quotes and escapes. */
function findArrayEnd(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("The DOCS array in the Design System file does not close.");
}

/**
 * Evaluates the array literal in an empty context (no globals). Variant fields use their first
 * declared value as the deterministic catalogue preview and retain the available variant names.
 * @param {string} fileText
 */
function extractDcDocs(fileText) {
  const match = MARKER.exec(fileText);
  if (!match) throw new Error("DOCS array not found in the Design System file.");
  const open = match.index + match[0].length - 1;
  const literal = fileText.slice(open, findArrayEnd(fileText, open));
  const raw = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 2000 });
  if (!Array.isArray(raw)) throw new Error("DOCS is not an array.");

  const components = [];
  const skipped = [];
  for (const entry of raw) {
    const variants = entry.html && typeof entry.html === "object" ? Object.keys(entry.html) : [];
    const first = variants[0];
    const html = typeof entry.html === "string" ? entry.html : first && entry.html[first];
    const css = typeof entry.css === "string" ? entry.css : first && entry.css[first];
    if (typeof html === "string" && typeof css === "string") {
      components.push({ id: String(entry.id), name: String(entry.name), states: String(entry.states || ""), desc: String(entry.desc || ""), html, css, variants });
    } else skipped.push({ id: String(entry.id), name: String(entry.name), reason: "component has no usable HTML/CSS preview" });
  }
  return { components, skipped };
}

/** Distinct class names used in a component's markup, in order of appearance. */
function classNames(html) {
  const found = new Set();
  for (const match of html.matchAll(/class="([^"]+)"/g)) for (const name of match[1].split(/\s+/)) if (name) found.add(name);
  return [...found];
}

/**
 * Custom properties a component reads but does not define itself (in its CSS or in inline styles),
 * so they must come from the project's token file.
 */
function requiredTokens(component) {
  const text = `${component.html}\n${component.css}`;
  const local = new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = [...component.css.matchAll(/var\((--[\w-]+)/g), ...component.html.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  return used.filter((name) => !local.has(name));
}

/** Sorted union of the tokens every component needs from the project. */
function allRequiredTokens(components) {
  return [...new Set(components.flatMap(requiredTokens))].sort();
}

module.exports = { extractDcDocs, classNames, requiredTokens, allRequiredTokens, findArrayEnd };
