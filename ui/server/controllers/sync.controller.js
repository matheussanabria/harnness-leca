// @ts-check
const path = require("path");
const { spawn } = require("child_process");
const { getRoot, slugs, send, readJsonBody, HEADERS } = require("../config");
const syncCore = require("../../../tools/lib/sync-core");

const SYNC_ENGINES = ["claude", "gemini", "opencode"];
let syncRunning = false;

async function apiSync({ req, res }) {
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }

  const raw = body && body.engines != null ? body.engines : "all";
  const parts = (Array.isArray(raw) ? raw : String(raw).split(",")).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const engines = !parts.length || parts.includes("all") ? SYNC_ENGINES.slice() : parts;
  if (engines.some((e) => !SYNC_ENGINES.includes(e))) {
    return send(res, 400, { error: `Motor inválido. Use: ${SYNC_ENGINES.join(", ")} ou "all".` });
  }
  if (!slugs().length) return send(res, 400, { error: "Nenhum projeto em projects/ para sincronizar." });
  if (syncRunning) return send(res, 409, { error: "Já há uma sincronização em andamento." });

  const dryRun = body && body.dryRun === true;
  const syncScript = path.resolve(__dirname, "..", "..", "..", "tools", "sync.js");
  const args = ["--no-warnings", syncScript, "--engine", engines.join(",")];
  if (dryRun) args.push("--dry-run");

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });

  syncRunning = true;
  const started = Date.now();
  let finished = false;
  let buf = "";
  const emit = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* conexão caiu */
    }
  };
  const finish = (code) => {
    if (finished) return;
    finished = true;
    syncRunning = false;
    if (buf.trim()) emit({ type: "log", line: buf.trimEnd() });
    emit({ type: "done", code, ms: Date.now() - started });
    res.end();
  };

  let child;
  try {
    child = spawn(process.execPath, args, { cwd: getRoot(), env: process.env, windowsHide: true });
  } catch (err) {
    console.error("[sync]", (err && err.stack) || err);
    emit({ type: "error", error: "Não foi possível executar tools/sync.js. O detalhe está no terminal do servidor." });
    finish(-1);
    return;
  }
  const onChunk = (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.search(/[\r\n]/)) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
      if (line.trim()) emit({ type: "log", line });
    }
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);
  child.on("error", (err) => {
    console.error("[sync]", (err && err.stack) || err);
    emit({ type: "error", error: "Não foi possível executar tools/sync.js. O detalhe está no terminal do servidor." });
    finish(-1);
  });
  child.on("close", (code) => finish(code));
  res.on("close", () => {
    if (finished) return;
    finished = true;
    syncRunning = false;
    try {
      child.kill();
    } catch {
      /* já encerrou */
    }
  });
}

async function apiProjectSync({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  const engine = body && body.engine ? body.engine : "all";
  try {
    const engines = engine === "all" ? ["claude", "gemini", "opencode"] : [engine];
    const result = syncCore.syncProject({ slug, engines });
    return send(res, 200, result);
  } catch (err) {
    console.error("[sync]", (err && err.stack) || err);
    return send(res, 500, { error: "Falha ao sincronizar conversas." });
  }
}

module.exports = {
  apiSync,
  apiProjectSync,
};
