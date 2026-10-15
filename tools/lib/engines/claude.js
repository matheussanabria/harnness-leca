// Motor 1: Claude Code (CLI com streaming). Roda por projeto, com o repo, as permissões e os MCPs de projects/<slug>/mcp.json.
const path = require("path");
const cp = require("child_process");
const { ROOT } = require("../root");
const { resolveClaudeBin } = require("../claude-bin");
const { loadProjectConfig } = require("../project-mcp");
const { PublicError, safeModel, safeEffort, getProjectContext } = require("./common");

// Encerra o processo e tudo que ele abriu (MCPs, comandos). No Windows, child.kill() mataria só o claude.exe.
function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    cp.execFile(taskkill, ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
  } else {
    child.kill("SIGTERM");
  }
}

function streamClaude({ prompt, slug, sessionId, model, effort, signal, onChunk, onDone, onError }) {
  const projDir = path.join(ROOT, "projects", slug);
  const args = ["-p", "-", "--output-format", "stream-json", "--verbose"];
  const isClaudeUuid = sessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
  if (isClaudeUuid) {
    args.push("--resume", sessionId);
  }
  model = safeModel(model);
  if (model && model !== "default") {
    args.push("--model", model);
  }
  args.push("--effort", safeEffort(effort));
  let cwd;
  try {
    const session = claudeSession(projDir);
    cwd = session.cwd;
    args.push(...session.args);
  } catch (err) {
    return onError(new PublicError(err.message)); // erros de projects/<slug>/mcp.json são mensagens nossas
  }

  let fullPrompt = prompt;
  // Se for início de sessão, injeta o contexto do projeto junto ao primeiro prompt
  if (!isClaudeUuid) {
    const ctx = getProjectContext(slug);
    if (ctx) fullPrompt = `${ctx}\nPergunta do usuário:\n${fullPrompt}`;
  }

  const bin = resolveClaudeBin();
  if (!bin) return onError(new PublicError("Claude Code não encontrado no PATH (defina CLAUDE_BIN em global/.env)."));
  // shell:false com caminho absoluto: os argumentos não passam pelo cmd.exe e nada é buscado na pasta atual.
  const child = cp.spawn(bin, args, {
    shell: false,
    windowsHide: true,
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (signal) {
    if (signal.aborted) killTree(child);
    else signal.addEventListener("abort", () => killTree(child), { once: true });
  }

  const parser = createClaudeStreamParser(onChunk, sessionId);
  let buffer = "";

  child.stdin.write(fullPrompt);
  child.stdin.end();

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // guarda linha incompleta
    lines.forEach(parser.line);
  });

  let errBuf = "";
  child.stderr.on("data", (d) => { errBuf += d.toString(); });

  child.on("close", (code) => {
    if (buffer) parser.line(buffer);
    if (code !== 0 && !parser.text) {
      return onError(new Error(errBuf.trim() || `Claude Code finalizou com código ${code}`));
    }
    onDone({ sessionId: parser.sessionId, fullText: parser.text });
  });

  child.on("error", onError);
}

const READ_TOOLS = ["Read", "Glob", "Grep"];
const EDIT_TOOLS = ["Edit", "Write", "NotebookEdit"];
const COMMAND_TOOLS = ["Bash", "PowerShell"];

// Onde e com que permissões o Claude roda no chat da interface (ver tools/lib/project-mcp.js).
// - Pasta de trabalho: o repo do projeto (com projects/<slug> junto, para chats e contexto) ou só projects/<slug>.
// - --restricted: ferramentas de arquivo presas às pastas de trabalho, settings do usuário e do repo ignorados,
//   bypassPermissions recusado, e escrita em configs/git/ferramentas nunca aprovada sozinha.
// - Modo "completo" (padrão): edita (acceptEdits) e roda comandos. Modo "leitura": só Read/Glob/Grep.
// - --strict-mcp-config: só os MCPs declarados no mcp.json do projeto; os do usuário e de outros ficam de fora.
function claudeSession(projDir) {
  const cfg = loadProjectConfig(projDir);
  const full = cfg.modo === "completo";
  const tools = [...READ_TOOLS, ...(full ? [...EDIT_TOOLS, ...COMMAND_TOOLS] : [])];
  const args = ["--restricted", "--tools", tools.join(","), "--strict-mcp-config"];
  if (cfg.repo) args.push("--add-dir", projDir);
  if (full) args.push("--permission-mode", "acceptEdits");

  // No -p ninguém responde a pedidos de permissão: o que não estiver liberado aqui é negado.
  const allowed = [...(full ? COMMAND_TOOLS : []), ...cfg.names.map((n) => `mcp__${n}`)];
  if (cfg.names.length) args.push("--mcp-config", JSON.stringify({ mcpServers: cfg.mcpServers }));
  if (allowed.length) args.push("--allowedTools", allowed.join(","));
  return { cwd: cfg.repo || projDir, args };
}

// Interpreta as linhas do `claude --output-format stream-json` e repassa só o trecho novo de cada bloco.
// Cada bloco (id da mensagem + índice) é acompanhado à parte: um texto novo depois de uma ferramenta
// começa do zero e não pode ser cortado pelo tamanho do texto anterior.
function createClaudeStreamParser(onChunk, initialSessionId) {
  let sessionId = initialSessionId || null;
  let text = "";
  let events = 0;
  const seen = new Map();
  const deltaOf = (key, full) => {
    const before = seen.get(key);
    seen.set(key, full.length);
    return before === undefined ? { delta: full, fresh: true } : { delta: full.slice(before), fresh: false };
  };

  function line(raw) {
    if (!raw.trim()) return;
    let d;
    try { d = JSON.parse(raw); } catch { return; } // ignora linhas que não são JSON
    if (d.session_id) sessionId = d.session_id;
    events++;

    if (d.type === "assistant" && d.message && Array.isArray(d.message.content)) {
      const msgId = d.message.id || `evt${events}`;
      d.message.content.forEach((c, i) => {
        const key = `${msgId}:${i}`;
        if (c.type === "text" && c.text) {
          let { delta, fresh } = deltaOf(key, c.text);
          if (fresh && text) delta = "\n\n" + delta;
          if (delta) {
            text += delta;
            onChunk({ type: "text", text: delta, sessionId });
          }
        } else if (c.type === "thinking" && c.thinking) {
          const { delta } = deltaOf(key, c.thinking);
          if (delta) onChunk({ type: "thinking", text: delta, sessionId });
        }
      });
    }

    if (d.type === "result" && d.result && !text) {
      text = d.result;
      onChunk({ type: "text", text: d.result, sessionId });
    }
  }

  return { line, get text() { return text; }, get sessionId() { return sessionId; } };
}

// `claude -v` assíncrono e guardado por um minuto: a versão síncrona travava o servidor inteiro a cada consulta.
const CLAUDE_CHECK_TTL_MS = 60_000;
let claudeCheck = { at: 0, ok: false };
function claudeAvailable() {
  if (Date.now() - claudeCheck.at < CLAUDE_CHECK_TTL_MS) return Promise.resolve(claudeCheck.ok);
  const bin = resolveClaudeBin();
  if (!bin) return Promise.resolve(false);
  return new Promise((resolve) => {
    cp.execFile(bin, ["-v"], { windowsHide: true, timeout: 3000 }, (err) => {
      claudeCheck = { at: Date.now(), ok: !err };
      resolve(claudeCheck.ok);
    });
  });
}

module.exports = {
  id: "claude",
  stream: streamClaude,
  // Parte dinâmica do status; o resto vem de catalog.json.
  status: async () => ({ available: await claudeAvailable() }),
  killTree,
  claudeSession,
  createClaudeStreamParser,
};
