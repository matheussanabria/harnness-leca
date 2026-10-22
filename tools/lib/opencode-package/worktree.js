// @ts-check
// git worktree por pacote. Caminho curto (C:/Temp/hl-<id>) por causa do limite de caminho do Windows.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

/** @param {string[]} args @param {string} cwd */
function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout || "").trim(), err: String(r.stderr || "").trim() };
}

const worktreeDir = (/** @type {string} */ id) => path.join(process.env.HARNESS_PACKAGE_DIR || (process.platform === "win32" ? "C:/Temp" : os.tmpdir()), `hl-${id.replace(".", "-")}`);

/**
 * Cria (ou reaproveita a branch de) o worktree e tenta avançar a branch até a base sem merge.
 * @returns {{ dir: string, created: boolean, behind: boolean }}
 */
function createWorktree(root, { id, branch, base }) {
  const dir = worktreeDir(id);
  if (fs.existsSync(dir)) throw new Error(`O worktree ${dir} já existe. Remova-o antes (git worktree remove ${dir}) ou revise o trabalho dele.`);
  if (!git(["rev-parse", "--verify", base], root).ok) throw new Error(`Branch base "${base}" não existe.`);
  const exists = git(["rev-parse", "--verify", branch], root).ok;
  const args = exists ? ["worktree", "add", dir, branch] : ["worktree", "add", "-b", branch, dir, base];
  const r = git(args, root);
  if (!r.ok) throw new Error(`git worktree add falhou: ${r.err.slice(0, 300)}`);
  const behind = exists ? !git(["merge", "--ff-only", base], dir).ok : false;
  return { dir, created: !exists, behind };
}

/** Caminhos alterados ou novos no worktree (inclui não rastreados). */
function changedFiles(dir) {
  const r = git(["status", "--porcelain", "-uall"], dir);
  if (!r.ok) throw new Error(`git status falhou: ${r.err.slice(0, 200)}`);
  return r.out.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, ""));
}

module.exports = { git, worktreeDir, createWorktree, changedFiles };
