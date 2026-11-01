// @ts-check
// File scopes of a story: which paths it may touch, and whether two stories would edit the same files.
// Source, in order: frontmatter `owns: [globs]`, then the "## 5." file list used by EP-14 stories.
const fs = require("fs");
const path = require("path");

/** Files every story may touch; the integrator resolves them at merge time, so they never block a claim. */
const SHARED = new Set(["MAPA.md", "docs/mapa/INDEX.md"]);

/** List item -> glob: drops the bullet, backticks and a trailing "(comment)". */
function toPattern(line) {
  return line.replace(/^-\s*/, "").replace(/`/g, "").replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * @param {string} body story markdown
 * @returns {string[]} declared globs, shared files excluded
 */
function parseScopes(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const head = text.startsWith("---") ? text.split(/^---\s*$/m)[1] || "" : "";
  const owns = head.match(/^owns:\s*\[(.*)\]\s*$/m);
  let globs = owns ? owns[1].split(",").map((g) => g.trim().replace(/^["'`]|["'`]$/g, "")) : [];
  if (!globs.length) {
    const section = (text.split(/^## 5\./m)[1] || "").split(/^## /m)[0];
    globs = section.split("\n").filter((l) => l.startsWith("- ")).map(toPattern);
  }
  return [...new Set(globs.map((g) => g.replace(/\\/g, "/").replace(/^\.\//, "")).filter((g) => g && !SHARED.has(g)))];
}

/**
 * Reads the scopes of a ledger story from its document (relative to docs/harness-evolution).
 * @param {string} root repository root
 * @param {string | null} document
 */
function readScopes(root, document) {
  if (!document) return [];
  const base = path.join(root, "docs", "harness-evolution");
  const file = path.resolve(base, document);
  if (!file.startsWith(`${base}${path.sep}`) || !fs.existsSync(file)) return [];
  return parseScopes(fs.readFileSync(file, "utf8"));
}

/** Literal part of a glob before its first wildcard: "ui/server/**" -> "ui/server/". */
function prefix(glob) {
  const i = glob.search(/[*?[{]/);
  return i < 0 ? glob : glob.slice(0, i);
}

/**
 * Conservative overlap: two globs overlap when one literal prefix contains the other.
 * May report overlaps that real files never hit (e.g. "a/*.js" vs "a/*.css"); never misses a real one.
 * @param {string} a
 * @param {string} b
 */
function globsOverlap(a, b) {
  if (a === b) return true;
  const pa = prefix(a);
  const pb = prefix(b);
  const wildA = pa !== a;
  const wildB = pb !== b;
  if (!wildA && !wildB) return false;
  if (!wildA) return a.startsWith(pb);
  if (!wildB) return b.startsWith(pa);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

/**
 * Pairs of stories whose scopes overlap. A story without scopes conflicts with everything: it is unbounded.
 * @param {{ id: string, fileScopes: string[] }[]} stories
 * @returns {{ a: string, b: string, globs: string[] }[]}
 */
function findConflicts(stories) {
  const out = [];
  for (let i = 0; i < stories.length; i++) {
    for (let j = i + 1; j < stories.length; j++) {
      const a = stories[i];
      const b = stories[j];
      if (!a.fileScopes.length || !b.fileScopes.length) {
        out.push({ a: a.id, b: b.id, globs: ["(no declared scope)"] });
        continue;
      }
      const globs = a.fileScopes.flatMap((ga) => b.fileScopes.filter((gb) => globsOverlap(ga, gb)).map((gb) => `${ga} ~ ${gb}`));
      if (globs.length) out.push({ a: a.id, b: b.id, globs });
    }
  }
  return out;
}

module.exports = { SHARED, toPattern, parseScopes, readScopes, globsOverlap, findConflicts };
