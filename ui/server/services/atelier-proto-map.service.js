// @ts-check
// Compact prototype map plus a content hash, injected at the top of the Atelier AI context.
//
// Why: the full file dump below it is long, so the model loses the overall shape (who links to whom, which storage keys and
// CSS classes exist). The hash changes whenever any screen, the CSS or the registered screens change, so the agent can tell
// that the prototype moved under it (version restore, canvas edit) and must re-read the state instead of trusting memory.
const crypto = require("crypto");
const { navGraph } = require("./atelier-nav-contract.service");

const MAX_CLASSES = 24;
const MAX_STORAGE = 12;
const MAX_COMPONENTS = 8;
const MAX_MAP_CHARS = 1100; // about 275 tokens at 4 chars per token; hard ceiling is 300

/** Hash of everything the agent can see or edit: screens, CSS and the registered screen ids. */
function protoHash(/** @type {{screens: Array<{id:string,html:string}>, css: string, registered: string[]}} */ p) {
  const h = crypto.createHash("sha256");
  for (const s of [...p.screens].sort((a, b) => a.id.localeCompare(b.id))) h.update(`screen:${s.id}\0${s.html}\0`);
  h.update(`css\0${p.css}\0reg\0${[...p.registered].sort().join(",")}`);
  return h.digest("hex").slice(0, 12);
}

/** Class names defined in the CSS (selectors only), most frequently used first, capped. */
function cssClasses(/** @type {string} */ css) {
  const counts = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)(?=[^{}]*\{)/g)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  const all = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { shown: all.slice(0, MAX_CLASSES).map(([n]) => n), total: all.length };
}

function capList(/** @type {string[]} */ list, /** @type {number} */ max) {
  return list.length > max ? `${list.slice(0, max).join(", ")} (+${list.length - max})` : list.join(", ");
}

/**
 * @param {{ protoId: string, screens: Array<{id:string,html:string}>, css: string, registered: string[], storage: string[], components?: string[] }} p
 * @returns {{ hash: string, text: string }}
 */
function buildProtoMap(p) {
  const hash = protoHash(p);
  const { edges, broken } = navGraph(p.screens);
  const cls = cssClasses(p.css);
  const lines = [`## Prototype map "${p.protoId}" | hash ${hash}`];
  lines.push(`Screens (${p.screens.length}): ${p.screens.map((s) => s.id).join(", ") || "none"}`);
  if (edges) lines.push(`Nav: ${edges}`);
  if (broken) lines.push(`Broken nav (target missing): ${broken}`);
  if (p.storage.length) lines.push(`Storage: ${capList(p.storage, MAX_STORAGE)}`);
  if (cls.total) lines.push(`CSS classes (${cls.total}): ${cls.shown.map((c) => `.${c}`).join(" ")}${cls.total > MAX_CLASSES ? " ..." : ""}`);
  if (p.components && p.components.length) lines.push(`Components: ${capList(p.components, MAX_COMPONENTS)}`);
  lines.push("If this hash differs from the one you saw earlier in this conversation, the prototype changed: trust the state below, not your memory.");
  let text = lines.join("\n");
  if (text.length > MAX_MAP_CHARS) text = `${text.slice(0, MAX_MAP_CHARS - 4)} ...`;
  return { hash, text };
}

module.exports = { buildProtoMap, protoHash, cssClasses, MAX_MAP_CHARS };
