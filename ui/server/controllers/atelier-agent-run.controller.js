// @ts-check
// Controller para execução do Atelier Agent Loop via SSE (EP-15.05).
const path = require("path");
const { getProjects, send, readJsonBody, slugs } = require("../config");
const { createAtelierAgentLoop } = require("../services/atelier-agent-loop.service");
const { buildGeminiModelTurn, buildOpenCodeModelTurn } = require("../services/atelier-engine-adapters.service");
const { loadEnv } = require("../../../tools/lib/env");
const { describeError, errorEvent } = require("../../../tools/lib/engines/errors");

/**
 * Inicia ou retoma o loop do agente para um protótipo com streaming SSE.
 * Endpoint: POST /api/project/:slug/design/prototypes/:protoId/agent-run
 */
async function apiPrototypesAgentRun({ req, res, params: [slug, protoId] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "Projeto não encontrado" });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "Payload JSON inválido" });
  }

  const { prompt = "", engine = "gemini", model, effort = "medium", author = "agent", maxTurns, sessionId } = body || {};

  const projectDir = path.join(getProjects(), slug);
  loadEnv();
  const startedAt = Date.now();
  console.log(`[agent-run] ${protoId} engine=${engine} model=${model || "(padrão do servidor)"} effort=${effort}`);

  let modelTurn;
  if (engine === "gemini") {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return send(res, 400, { error: "Chave do Gemini (GEMINI_API_KEY) não configurada no ambiente." });
    }
    modelTurn = buildGeminiModelTurn({ key, model: model || "gemini-2.5-flash", effort });
  } else if (engine === "opencode") {
    modelTurn = buildOpenCodeModelTurn({ model, effort, sessionId });
  } else {
    // Fallback padrão para Gemini
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key) {
      modelTurn = buildGeminiModelTurn({ key, model: model || "gemini-2.5-flash", effort });
    } else {
      return send(res, 400, { error: `Motor '${engine}' não suportado ou sem credenciais configuradas.` });
    }
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Sem bytes por muito tempo o navegador/túnel derruba o fluxo ("network error"): envia cabeçalhos já e um ping periódico.
  res.flushHeaders?.();
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, 15000);
  res.on("close", () => clearInterval(heartbeat));

  const abortController = new AbortController();
  res.on("close", () => { if (!res.writableFinished) abortController.abort(); });

  const emit = (data) => {
    try {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch {}
  };

  try {
    const loop = createAtelierAgentLoop({
      projectDir,
      protoId,
      author,
      maxTurns,
      modelTurn,
    });

    const result = await loop.run(prompt, {
      signal: abortController.signal,
      onEvent: (event) => {
        if (["turn_start", "turn_end", "tool_exec_start", "tool_exec_end", "complete", "yield", "error"].includes(event.type)) {
          console.log(`[agent-run] +${((Date.now() - startedAt) / 1000).toFixed(1)}s ${event.type}${event.turn ? ` turno ${event.turn}` : ""}${event.name ? ` ${event.name}` : ""}${event.type === "tool_exec_end" ? (event.ok ? " ok" : " ERRO") : ""}`);
        }
        emit(event);
      },
    });

    emit({ type: "done", result });
  } catch (err) {
    console.log(`[agent-run] +${((Date.now() - startedAt) / 1000).toFixed(1)}s falhou: ${err.message || err}`);
    emit(errorEvent(describeError(err, { engine })));
  } finally {
    try {
      res.end();
    } catch {}
  }
}

module.exports = {
  apiPrototypesAgentRun,
};
