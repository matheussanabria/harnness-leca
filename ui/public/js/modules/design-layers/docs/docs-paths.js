// @ts-check
// Path rules of the documentation reader (pure, no DOM): relative links, Obsidian [[wikilinks]] and the
// anchor conventions shared with the server index (ui/server/services/project-docs/refs-parsers.js).

/** Anchor of a rule row: "RN-calculo-001" -> "rn-calculo-001". @param {string} id */
export const rnAnchor = (id) => String(id).toLowerCase();
/** Anchor of an acceptance criterion. @param {string|number} n */
export const criterionAnchor = (n) => `criterio-${n}`;
/** Anchor of a line in a code view (rastreio.yml). @param {number} line */
export const lineAnchor = (line) => `L${line}`;

/** @param {string} p */
export const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

/**
 * Joins a relative link to the folder of the current file. Null when it leaves doc/ or is not a plain path.
 * @param {string} fromPath file being read, relative to doc/
 * @param {string} href relative link without the "#anchor"
 * @returns {string | null}
 */
export function joinRelative(fromPath, href) {
  let text = String(href || "");
  try {
    text = decodeURI(text);
  } catch {
    return null;
  }
  if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/") || text.includes("\\")) return null;
  const out = dirOf(fromPath) ? dirOf(fromPath).split("/") : [];
  for (const part of text.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/") || null;
}

/** Common leading folders of two paths. @param {string} a @param {string} b */
function sharedDepth(a, b) {
  const x = a.split("/");
  const y = b.split("/");
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n += 1;
  return n;
}

/**
 * Resolves an Obsidian target ("calculo-dispensacao/_status", "_contrato-rastreio", "regras.md") to a file.
 * Order: same folder, then any file whose path ends with the target; ties go to the closest folder.
 * @param {string} target text inside [[...]] without "#anchor" or "|label"
 * @param {string} fromPath
 * @param {string[]} paths every file of the tree
 * @returns {string | null}
 */
export function resolveWikilink(target, fromPath, paths) {
  const name = String(target || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!name || name.includes("..")) return null;
  const hasExt = /\.(md|ya?ml|json)$/i.test(name);
  const wanted = hasExt ? [name] : [`${name}.md`, `${name}.yml`, `${name}.json`];
  const set = new Set(paths);
  const dir = dirOf(fromPath);
  for (const w of wanted) {
    const local = dir ? `${dir}/${w}` : w;
    if (set.has(local)) return local;
  }
  for (const w of wanted) {
    const lower = w.toLowerCase();
    const hits = paths.filter((p) => p.toLowerCase() === lower || p.toLowerCase().endsWith(`/${lower}`));
    if (hits.length) return hits.sort((a, b) => sharedDepth(b, dir) - sharedDepth(a, dir) || a.length - b.length)[0];
  }
  return null;
}

/**
 * GitHub-style heading slug, kept for accented letters; repeated slugs get "-1", "-2".
 * @param {string} text plain heading text
 * @param {Map<string, number>} seen slugs already used in the document
 */
export function slugify(text, seen) {
  const base = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-") || "secao";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}
