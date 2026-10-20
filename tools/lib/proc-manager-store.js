// @ts-check
// Estado/constantes compartilhados de proc-manager.
const path = require("path");
const { ROOT } = require("./root");

const PROJECTS = path.join(ROOT, "projects");

/**
 * Estado em memória dos processos em execução indexados por chave (ex: "slug:serviceId")
 * @type {Map<string, {
 *   slug: string,
 *   serviceId: string,
 *   name: string,
 *   command: string,
 *   cwd: string,
 *   url: string,
 *   child: cp.ChildProcess,
 *   pid: number,
 *   startedAt: number,
 *   logs: string[],
 *   status: 'starting' | 'running' | 'stopped' | 'failed',
 *   exitCode: number | null,
 *   listeners: Set<(chunk: { type: 'stdout'|'stderr'|'status', text: string }) => void>
 * }>}
 */
const runningServices = new Map();

module.exports = { PROJECTS, runningServices };
