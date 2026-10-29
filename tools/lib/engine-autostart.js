// @ts-check
// Sobe os serviços locais dos motores (9router e opencode) quando a interface inicia e eles não estão no ar.
// HARNESS_AUTOSTART=0 desliga. Nunca derruba a interface: falhas só viram uma linha no terminal.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("./root");
const { loadEnv } = require("./env");

/**
 * `direct` aponta o executável real dentro do npm global: os atalhos .cmd passam por um cmd.exe que abre console visível
 * (o 9router chega a mostrar o menu "Choose Interface"). Sem ele, cai no comando do PATH.
 * @type {Array<{ name: string, probe: string, command: string, args: string[], envBin?: string, needsPassword?: boolean, direct?: (env: NodeJS.ProcessEnv) => { file: string, args: string[] } | null }>}
 */
const SERVICES = [
  // O opencode usa o 9router como provedor do modelo "Harness", então ele sobe primeiro.
  { name: "9router", probe: "http://127.0.0.1:20128/", command: "9router", args: ["--no-browser", "--skip-update"],
    direct: (env) => npmGlobal(env, ["9router", "cli.js"], (f) => ({ file: process.execPath, args: [f, "--no-browser", "--skip-update"] })) },
  { name: "opencode", probe: "http://127.0.0.1:63186/api/info", needsPassword: true, command: "opencode", args: ["serve", "--port", "63186"], envBin: "OPENCODE_BIN",
    direct: (env) => npmGlobal(env, ["@opencode", "cli", "bin", "opencode.exe"], (f) => ({ file: f, args: ["serve", "--port", "63186"] })) },
];

function npmGlobal(/** @type {NodeJS.ProcessEnv} */ env, /** @type {string[]} */ parts, /** @type {(f: string) => { file: string, args: string[] }} */ make) {
  if (process.platform !== "win32" || !env.APPDATA) return null;
  const file = path.join(env.APPDATA, "npm", "node_modules", ...parts);
  return fs.existsSync(file) ? make(file) : null;
}

/** Qualquer resposta HTTP (até 401/404) significa que o serviço está de pé; só recusa de conexão ou silêncio conta como desligado. */
async function isUp(/** @type {string} */ url, fetchFn = globalThis.fetch) {
  try {
    // redirect manual: o 9router responde 307 para uma página que ele compila na 1ª visita (lenta); basta saber que respondeu.
    await fetchFn(url, { redirect: "manual", signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

/**
 * A API v2 do opencode exige senha (Basic, usuário "opencode"). Ela precisa sobreviver ao restart da interface porque o
 * servidor continua rodando: fica em global/.env (ignorado pelo git), gerada uma única vez.
 * @returns {string} a senha em uso (também deixada em env.OPENCODE_SERVER_PASSWORD)
 */
function ensureOpenCodePassword(env = process.env, envFile = path.join(ROOT, "global", ".env")) {
  if (env === process.env) loadEnv(); // a senha pode já estar em global/.env: nunca gerar uma segunda por cima
  if (env.OPENCODE_SERVER_PASSWORD) return env.OPENCODE_SERVER_PASSWORD;
  const pass = crypto.randomBytes(18).toString("hex");
  try {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    const prev = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
    fs.appendFileSync(envFile, `${prev && !prev.endsWith("\n") ? "\n" : ""}OPENCODE_SERVER_PASSWORD=${pass}\n`);
  } catch (err) {
    console.log(`[autostart] não foi possível gravar a senha do OpenCode em global/.env (${err.message}); vale só até fechar a interface.`);
  }
  env.OPENCODE_SERVER_PASSWORD = pass;
  return pass;
}

function startDetached(/** @type {typeof SERVICES[number]} */ svc, env = process.env) {
  const direct = !(svc.envBin && env[svc.envBin]) && svc.direct ? svc.direct(env) : null;
  const bin = direct ? direct.file : (svc.envBin && env[svc.envBin]) || svc.command;
  const args = direct ? direct.args : svc.args;
  // Sem shell e com o executável real: nenhuma janela de console; o processo fica independente da interface.
  const child = spawn(bin, args, { detached: true, stdio: "ignore", windowsHide: true, env, shell: !direct && process.platform === "win32" });
  child.on("error", (err) => console.log(`[autostart] ${svc.name}: não foi possível iniciar (${err.message}). Rode manualmente: ${svc.command} ${svc.args.join(" ")}`));
  child.unref();
}

async function waitUntilUp(/** @type {string} */ url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Liga em sequência os que estiverem desligados. Resolve com o estado de cada serviço (usado nos testes). */
async function ensureEngineServices({ env = process.env, services = SERVICES, log = console.log, waitMs = 30000 } = {}) {
  /** @type {Record<string, "already-up" | "started" | "failed">} */
  const result = {};
  if (env.HARNESS_AUTOSTART === "0" || env.HARNESS_ROOT) return result; // HARNESS_ROOT = testes de unidade
  for (const svc of services) {
    if (await isUp(svc.probe)) { result[svc.name] = "already-up"; continue; }
    log(`[autostart] ${svc.name} está desligado: iniciando...`);
    if (svc.needsPassword) ensureOpenCodePassword(env);
    startDetached(svc, env);
    const ok = await waitUntilUp(svc.probe, waitMs);
    result[svc.name] = ok ? "started" : "failed";
    log(ok ? `[autostart] ${svc.name} no ar.` : `[autostart] ${svc.name} não respondeu em ${Math.round(waitMs / 1000)} s. Rode manualmente: ${svc.command} ${svc.args.join(" ")}`);
  }
  return result;
}

module.exports = { ensureEngineServices, ensureOpenCodePassword, isUp, SERVICES };
