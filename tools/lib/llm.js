// @ts-check
// Pergunta única a um modelo, sem conversa e sem ferramentas úteis: usado na extração de memórias. O texto que vai no
// prompt é DADO (conversas importadas), então o modelo roda isolado: nada de escrever, executar comandos ou acessar a web.
//
//   claude   -> `claude -p --tools ""` (nenhuma ferramenta), numa pasta temporária.
//   opencode -> `opencode run` com um agente que só tem ferramentas de LEITURA, numa pasta temporária VAZIA, com escrita,
//               comandos, web e diretórios externos negados. Não dá para desligar todas as ferramentas: o plano gratuito
//               do OpenCode recusa (HTTP 403) pedidos de agentes sem nenhuma ferramenta, e isso é uma regra do serviço.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveClaudeBin } = require("./claude-bin");
const { resolveOpencodeBin, opencodeRunArgs, opencodeCwdEnv } = require("./opencode-bin");

const DEFAULT_OPENCODE_MODEL = "opencode/deepseek-v4.1-flash-free";
const TIMEOUT_MS = 300_000;
const MAX_BUFFER = 16 * 1024 * 1024;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,80}$/;
const FREE_MODEL_RE = /^opencode\/[A-Za-z0-9._-]+-free$/;

/** Só os modelos gratuitos do OpenCode vão sem pedir licença: groq/openrouter e afins usam as suas chaves e podem custar. */
const isFreeOpencodeModel = (/** @type {string} */ m) => FREE_MODEL_RE.test(m);

// Permissões do agente extrator: leitura (dentro da pasta vazia) é o único acesso que sobra.
const DENY = ["edit", "bash", "webfetch", "websearch", "task", "skill", "lsp", "external_directory", "doom_loop", "todowrite", "todoread"];

/** @returns {Record<string, unknown>} conteúdo do opencode.json da pasta temporária */
function opencodeConfig() {
  const permission = Object.fromEntries(DENY.map((k) => [k, "deny"]));
  return {
    $schema: "https://opencode.ai/config.json",
    autoupdate: false,
    share: "disabled",
    permission,
    agent: { extrator: { mode: "primary", description: "Só devolve texto", permission } },
  };
}

/** @param {string} prompt @param {string} [model] */
function askClaude(prompt, model) {
  if (model && !/^[\w.\-]+$/.test(model)) throw new Error("--model inválido");
  const bin = resolveClaudeBin();
  if (!bin) throw new Error("Claude Code não encontrado no PATH (defina CLAUDE_BIN)");
  const args = ["-p", "--tools", "", "--no-session-persistence", "--output-format", "text", ...(model ? ["--model", model] : [])];
  // O prompt vai por stdin; cwd numa pasta temporária. shell:false com caminho absoluto: nada passa pelo cmd.exe.
  const r = spawnSync(bin, args, { input: prompt, encoding: "utf8", shell: false, windowsHide: true, cwd: os.tmpdir(), timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error || "falha").slice(0, 300));
  return r.stdout.trim();
}

/**
 * Eventos do `opencode run --format json` -> texto da resposta (ou o erro, como exceção).
 * @param {string} stdout
 */
function parseOpencodeEvents(stdout) {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const err = events.find((e) => e.type === "error");
  if (err) {
    const d = err.error && err.error.data;
    throw new Error(`opencode: ${(d && d.message) || (err.error && err.error.name) || "erro"}${d && d.statusCode ? ` (HTTP ${d.statusCode})` : ""}`.slice(0, 300));
  }
  return events.map((e) => (e.part && e.part.type === "text" ? e.part.text : "")).join("").trim();
}

/** @param {string} prompt @param {string} [model] @param {{ allowPaid?: boolean }} [opts] */
function askOpencode(prompt, model = DEFAULT_OPENCODE_MODEL, { allowPaid = false } = {}) {
  if (!MODEL_RE.test(model) || !model.includes("/")) throw new Error("--model inválido para o opencode (use provedor/modelo, ex.: " + DEFAULT_OPENCODE_MODEL + ")");
  if (!isFreeOpencodeModel(model) && !allowPaid) {
    throw new Error(`"${model}" não é um modelo gratuito do OpenCode e pode gerar custo na sua conta. Use um opencode/...-free ou passe --allow-paid.`);
  }
  const bin = resolveOpencodeBin();
  if (!bin) throw new Error("opencode não encontrado no PATH (defina OPENCODE_BIN)");

  // Pasta de trabalho vazia só com a configuração do agente; é apagada no fim.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-opencode-"));
  try {
    fs.writeFileSync(path.join(dir, "opencode.json"), JSON.stringify(opencodeConfig(), null, 2));
    // O prompt vai por stdin (a linha de comando do Windows aceita ~32 mil caracteres; o prompt tem dezenas de mil).
    const r = spawnSync(bin, opencodeRunArgs({ agent: "extrator", model }),
      { input: prompt, encoding: "utf8", shell: false, windowsHide: true, cwd: dir, env: opencodeCwdEnv(dir), timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER });
    if (r.error) throw new Error(String(r.error.message).slice(0, 300));
    const text = parseOpencodeEvents(r.stdout || "");
    if (r.status !== 0 && !text) throw new Error(String(r.stderr || `opencode saiu com código ${r.status}`).slice(0, 300));
    if (!text) throw new Error("opencode devolveu uma resposta vazia");
    return text;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function askOllama(prompt, model = "qwen3.5:4b") {
  // ask() é síncrono por legado de CLI, enquanto o cliente HTTP é assíncrono:
  // o runner local é executado em processo próprio e lê o prompt no stdin.
  const { spawnSync } = require("child_process");
  const runner = path.join(__dirname, "runtime", "ollama-cli.js");
  const r = spawnSync(process.execPath, [runner, "--model", model], {
    input: prompt,
    encoding: "utf8",
    cwd: path.resolve(__dirname, "../.."),
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error || "falha ao consultar Ollama local").slice(0, 300));
  const out = r.stdout.trim();
  if (!out) throw new Error("Ollama local devolveu uma resposta vazia");
  return out;
}

/**
 * @param {{ engine?: string, model?: string, prompt: string, allowPaid?: boolean }} req
 * @returns {string}
 */
function ask({ engine = "claude", model, prompt, allowPaid }) {
  if (engine === "claude") return askClaude(prompt, model);
  if (engine === "opencode") return askOpencode(prompt, model, { allowPaid });
  if (engine === "ollama") return askOllama(prompt, model);
  throw new Error(`motor "${engine}" não suportado na extração (use claude, opencode ou ollama)`);
}

module.exports = { ask, askClaude, askOpencode, askOllama, parseOpencodeEvents, opencodeConfig, isFreeOpencodeModel, DEFAULT_OPENCODE_MODEL };
