// @ts-check
// Which files under doc/ must never be listed or served: the "contains a secret" block of the project's
// .gitignore plus a fixed deny list (Postman files can hold saved responses with real data; the Jira snapshot is 4 MB).
const fs = require("node:fs");
const path = require("node:path");

/** Paths relative to doc/, with forward slashes. */
const FIXED_DENY = [
  /(^|\/)[^/]*\.postman_environment\.json$/i,
  /(^|\/)[^/]*\.postman_collection\.json$/i,
  /(^|\/)[^/]*\.postman_globals\.json$/i,
  /^scrum\/_jira-dis\.json$/i,
];

/** @param {string} glob gitignore pattern already relative to doc/ @param {boolean} anchored */
function globToRegExp(glob, anchored) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      out += ".*";
      i += 1;
    } else if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${anchored ? "^" : "(^|/)"}${out}(/.*)?$`, "i");
}

/**
 * Patterns of the .gitignore block whose comment says the files contain a secret ("segredo" or "secret"),
 * up to the next blank line. Only patterns that can match inside doc/ are kept, rewritten relative to doc/.
 * @param {string} text .gitignore content
 * @returns {RegExp[]}
 */
function parseSecretBlock(text) {
  const rules = [];
  let inBlock = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      inBlock = /segredo|secret/i.test(line);
      continue;
    }
    if (!line) {
      inBlock = false;
      continue;
    }
    if (!inBlock || line.startsWith("!")) continue;
    const pattern = line.replace(/\/+$/, "");
    const rooted = pattern.startsWith("/");
    const bare = pattern.replace(/^\/+/, "");
    if (/^doc\//i.test(bare)) rules.push(globToRegExp(bare.slice(4), true));
    else if (!rooted && !bare.includes("/")) rules.push(globToRegExp(bare, false));
  }
  return rules;
}

/** @param {string} repoRoot @returns {RegExp[]} */
function readSecretRules(repoRoot) {
  try {
    return parseSecretBlock(fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8"));
  } catch {
    return [];
  }
}

/**
 * @param {string} repoRoot
 * @returns {(rel: string) => boolean} true when the doc-relative path must stay hidden
 */
function createSecretFilter(repoRoot) {
  const rules = [...FIXED_DENY, ...readSecretRules(repoRoot)];
  return (rel) => rules.some((re) => re.test(rel));
}

module.exports = { createSecretFilter, parseSecretBlock, FIXED_DENY };
