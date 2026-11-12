// @ts-check
// Pacote de revisao a pedido da aba Scrum: GET diz se o projeto tem pacote e se esta defasado (barato),
// POST gera quadro, mapa e zip rodando tools/pacote-revisao.js em outro processo (o Vite leva alguns segundos).
const path = require("path");
const { execFile } = require("child_process");
const { getProjects, send } = require("../config");
const { context, hasConfig } = require("../../../tools/pacote-revisao/context");
const { packageStatus } = require("../../../tools/pacote-revisao/status");

const TOOL = path.resolve(__dirname, "..", "..", "..", "tools", "pacote-revisao.js");
const TIMEOUT_MS = 180000;
let running = false;

/** @param {string} slug */
function runBuild(slug) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [TOOL, "build", "--project", slug, "--zip", "--json"], {
      env: { ...process.env, HARNESS_PROJECTS_DIR: getProjects() },
      maxBuffer: 16 * 1024 * 1024,
      timeout: TIMEOUT_MS,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message).trim().split("\n").pop();
        return reject(new Error(detail || "Falha ao gerar o pacote."));
      }
      try {
        resolve(JSON.parse(String(stdout).trim().split("\n").pop() || "{}"));
      } catch {
        reject(new Error("A ferramenta nao devolveu um resumo valido."));
      }
    });
  });
}

/** GET /api/project/:slug/pacote-revisao */
async function apiProjectPacoteRevisaoStatus({ res, params: [slug] }) {
  if (!hasConfig(slug)) return send(res, 200, { configured: false });
  try {
    const status = packageStatus(context({ project: slug }));
    return send(res, 200, { configured: true, running, ...status });
  } catch (error) {
    return send(res, 200, { configured: true, running, error: error.message || String(error) });
  }
}

/** POST /api/project/:slug/pacote-revisao */
async function apiProjectPacoteRevisaoBuild({ res, params: [slug] }) {
  if (!hasConfig(slug)) return send(res, 404, { error: `O projeto '${slug}' nao tem pacote-revisao.json.` });
  if (running) return send(res, 409, { error: "Ja existe um pacote sendo gerado." });
  running = true;
  try {
    return send(res, 200, await runBuild(slug));
  } catch (error) {
    return send(res, 500, { error: error.message || String(error) });
  } finally {
    running = false;
  }
}

module.exports = { apiProjectPacoteRevisaoStatus, apiProjectPacoteRevisaoBuild };
