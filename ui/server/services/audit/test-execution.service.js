// @ts-check
// Execucao restrita do teste gerado (EP-11.02).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

const TIMEOUT_MS = 30000;
const MAX_OUTPUT = 4000;
const ALLOWED = Object.freeze([
  { command: "node", args: ["--test"], label: "node --test" },
  { command: "npm", args: ["test", "--silent"], label: "npm test" },
]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Resolve o comando autorizado para o artefato de teste.
 * @param {string} kind
 * @param {string} [file]
 * @returns {{ command: string, args: string[], label: string }}
 */
function resolveCommand(kind, file = "") {
  if (kind === "unit") return { command: "node", args: ["--test", file], label: "node --test" };
  if (kind === "bdd") return { command: "npm", args: ["test", "--silent"], label: "npm test" };
  throw fail(400, "Comando de teste nao autorizado para este tipo.");
}

/**
 * Executa o teste gerado com allowlist, sem shell e com timeout.
 * @param {{ projectDir: string, repoRoot: string, file: string, kind: string }} params
 * @returns {{ command: string, exitCode: number, durationMs: number, output: string, success: boolean }}
 */
function runGeneratedTest({ projectDir, repoRoot, file, kind }) {
  const target = path.resolve(projectDir, file);
  if (!target.startsWith(path.resolve(projectDir))) throw fail(400, "Arquivo de teste fora do projeto.");
  if (!fs.existsSync(target)) throw fail(409, "Artefato de teste nao encontrado.");

  const cwd = fs.existsSync(repoRoot) ? repoRoot : projectDir;
  const relative = path.relative(cwd, target).split(path.sep).join("/");
  const spec = resolveCommand(kind, relative);
  const started = Date.now();
  const result = spawnSync(spec.command, spec.args, {
    cwd,
    shell: false,
    timeout: TIMEOUT_MS,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "", NODE_ENV: "test" },
    maxBuffer: 4 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim().slice(0, MAX_OUTPUT);
  const exitCode = typeof result.status === "number" ? result.status : 1;
  return {
    command: `${spec.label} ${relative}`.trim(),
    exitCode,
    durationMs,
    output,
    success: exitCode === 0,
  };
}

module.exports = { TIMEOUT_MS, MAX_OUTPUT, ALLOWED, resolveCommand, runGeneratedTest };
