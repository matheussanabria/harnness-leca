// Pre-commit gates for the React islands (ADR-011), kept apart so pre-commit.js stays small:
//   - staged files under ui/web/: Biome on those files and a TypeScript check of ui/web;
//   - package.json or package-lock.json staged: `npm audit` of runtime dependencies (high or worse blocks).
// `run` is injectable for tests; it returns { status, output }.
const { spawnSync } = require("child_process");
const path = require("path");

const LINTABLE = /\.(ts|tsx|js|jsx|json|css)$/;
const OFFLINE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|network/i;
const bin = (root, rel) => path.join(root, "node_modules", ...rel.split("/"));

function defaultRun(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: options.shell || false, cwd: options.cwd });
  return { status: r.status ?? 1, output: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

const tail = (text) => text.split("\n").filter(Boolean).slice(-6).join(" | ");

/** @param {string} root @param {string[]} staged @param {typeof defaultRun} [run] @returns {string[]} problems */
function webGates(root, staged, run = defaultRun) {
  const problems = [];
  const files = staged.map((f) => f.replace(/\\/g, "/"));
  const web = files.filter((f) => f.startsWith("ui/web/") && LINTABLE.test(f) && f !== "ui/web/package.json");
  if (web.length) {
    const lint = run(process.execPath, [bin(root, "@biomejs/biome/bin/biome"), "check", "--no-errors-on-unmatched", ...web], { cwd: root });
    if (lint.status !== 0) problems.push(`biome check falhou: ${tail(lint.output)}`);
    const tsc = bin(root, "typescript/bin/tsc");
    for (const project of ["ui/web", "ui/web/tsconfig.node.json"]) {
      const types = run(process.execPath, [tsc, "-p", project], { cwd: root });
      if (types.status !== 0) problems.push(`tsc -p ${project} falhou: ${tail(types.output)}`);
    }
  }
  if (files.some((f) => f === "package.json" || f === "package-lock.json")) {
    const audit = run("npm", ["audit", "--omit=dev", "--audit-level=high"], { cwd: root, shell: true });
    // Offline (no registry) is not a vulnerability: warn instead of blocking the commit.
    if (audit.status !== 0 && OFFLINE.test(audit.output)) console.warn(`(npm audit pulado: registro inacessível) ${tail(audit.output)}`);
    else if (audit.status !== 0) problems.push(`npm audit encontrou vulnerabilidade alta ou crítica: ${tail(audit.output)}`);
  }
  return problems;
}

module.exports = { webGates, LINTABLE };
