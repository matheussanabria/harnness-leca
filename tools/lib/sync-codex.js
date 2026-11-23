// @ts-check
// Codex leg of the conversation sync. Shared by tools/sync.js (all projects) and tools/lib/sync-core.js (one project).
// A Codex session belongs to the project whose folder matches the session working directory (session_meta.cwd).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { projectFromPath } = require("./projects");

const CODEX_ROOT = path.join(os.homedir(), ".codex", "sessions");
const QUIET = /** @type {any} */ ({ log() {} });
const EMPTY = () => ({ nova: 0, atualizada: 0, igual: 0 });

/**
 * Groups Codex session files by project slug. Sessions without a cwd or outside any known project are reported, never
 * assigned, and no project is created for them.
 * @param {any[]} ms project matchers
 * @param {{ files?: string[], cwdOf?: (file: string) => string }} [options] injected for tests
 * @returns {{ bySlug: Map<string, string[]>, unmatched: Set<string> }}
 */
function codexSessionsBySlug(ms, options = {}) {
  const importer = require("../import-codex-chats");
  const files = options.files || importer.sessionFiles();
  const cwdOf = options.cwdOf || importer.sessionCwd;
  const bySlug = new Map();
  const unmatched = new Set();
  for (const file of files) {
    const cwd = cwdOf(file);
    const slug = cwd ? projectFromPath(cwd, ms) : null;
    if (!slug) { unmatched.add(cwd ? path.basename(cwd.replace(/[\\/]+$/, "")) || cwd : "(sem cwd)"); continue; }
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(file);
  }
  return { bySlug, unmatched };
}

/**
 * Imports the Codex sessions of one project.
 * @param {string} slug
 * @param {string[]} files session files already mapped to this slug
 * @param {boolean} dryRun
 */
function syncCodexFiles(slug, files, dryRun = false) {
  if (!files.length) return { ok: true, n: EMPTY(), err: "" };
  try {
    const r = require("../import-codex-chats").run(["--project", slug, ...(dryRun ? ["--dry-run"] : [])], QUIET, /** @type {any} */ ({ files }));
    return { ok: true, n: { nova: r.nova || 0, atualizada: r.atualizada || 0, igual: r.igual || 0 }, err: "" };
  } catch (e) {
    return { ok: false, n: EMPTY(), err: String(e && /** @type {any} */ (e).message).split("\n")[0] };
  }
}

/** Single-project entry used by sync-core. */
function syncCodexForProject(slug, ms, dryRun = false) {
  if (!fs.existsSync(CODEX_ROOT)) return { ok: false, n: EMPTY(), err: "indisponível (sem ~/.codex/sessions)" };
  const { bySlug } = codexSessionsBySlug(ms);
  return syncCodexFiles(slug, bySlug.get(slug) || [], dryRun);
}

module.exports = { CODEX_ROOT, codexSessionsBySlug, syncCodexFiles, syncCodexForProject };
