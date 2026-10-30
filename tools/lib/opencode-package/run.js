// @ts-check
// Orquestra um pacote: worktree -> opencode com escrita só ali -> guarda de arquivos -> relatório. Não commita nem faz merge.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveOpencodeBin, opencodeRunArgs, opencodeCwdEnv } = require("../opencode-bin");
const { parseOpencodeEvents, isFreeOpencodeModel, DEFAULT_OPENCODE_MODEL } = require("../llm");
const { parseStory } = require("./story");
const { findViolations } = require("./guard");
const { createWorktree, changedFiles, worktreeDir } = require("./worktree");
const { AGENT, packageConfig } = require("./config");
const { buildPrompt } = require("./prompt");

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,80}$/;
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * @param {string} root
 * @param {{ id: string, base?: string, model?: string, allowPaid?: boolean, dryRun?: boolean, timeoutMin?: number }} opts
 * @param {{ spawn?: typeof spawnSync }} [deps]
 */
function runPackage(root, opts, deps = {}) {
  const spawn = deps.spawn || spawnSync;
  const model = opts.model || DEFAULT_OPENCODE_MODEL;
  if (!MODEL_RE.test(model) || !model.includes("/")) throw new Error("--model inválido (use provedor/modelo).");
  if (!isFreeOpencodeModel(model) && !opts.allowPaid) throw new Error(`"${model}" não é gratuito. Use um opencode/...-free ou passe --allow-paid.`);

  const story = parseStory(root, opts.id);
  const wt = createWorktree(root, { id: story.id, branch: story.branch, base: opts.base || "ep14/integracao" });
  const prompt = buildPrompt(story);
  const cfgFile = path.join(os.tmpdir(), `hl-${story.id.replace(".", "-")}.opencode.json`);
  fs.writeFileSync(cfgFile, JSON.stringify(packageConfig(), null, 2));

  /** @type {Record<string, unknown>} */
  const report = { id: story.id, branch: story.branch, dir: wt.dir, model, behindBase: wt.behind, dryRun: Boolean(opts.dryRun) };
  if (!opts.dryRun) {
    const bin = resolveOpencodeBin();
    if (!bin) throw new Error("opencode não encontrado no PATH (defina OPENCODE_BIN).");
    const r = spawn(bin, opencodeRunArgs({ agent: AGENT, model, auto: true }), {
      input: prompt, encoding: "utf8", shell: false, windowsHide: true, cwd: wt.dir,
      timeout: (opts.timeoutMin || 30) * 60_000, maxBuffer: MAX_BUFFER, env: opencodeCwdEnv(wt.dir, { OPENCODE_CONFIG: cfgFile }),
    });
    report.exitCode = r.status;
    try { report.summary = parseOpencodeEvents(String(r.stdout || "")).slice(0, 4000); } catch (e) { report.error = String(/** @type {Error} */ (e).message); }
    if (r.error) report.error = String(r.error.message).slice(0, 300);
  }
  Object.assign(report, verifyWorktree(wt.dir, story.allowed));
  report.ok = !opts.dryRun ? report.violations.length === 0 && !report.error && report.exitCode === 0 : true;
  fs.writeFileSync(`${wt.dir}.report.json`, JSON.stringify(report, null, 2));
  fs.rmSync(cfgFile, { force: true });
  return report;
}

/** Só confere um worktree existente (revisão depois da execução). */
function verifyWorktree(dir, allowed) {
  const changed = changedFiles(dir);
  return { changed, violations: findViolations(changed, allowed) };
}

/** @param {string} root @param {string} id */
function verifyStory(root, id) {
  const story = parseStory(root, id);
  return { id, branch: story.branch, dir: worktreeDir(id), ...verifyWorktree(worktreeDir(id), story.allowed) };
}

module.exports = { runPackage, verifyStory };
