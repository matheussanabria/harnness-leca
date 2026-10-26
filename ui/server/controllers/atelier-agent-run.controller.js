// @ts-check
// Controller para execução do Atelier Agent Loop via SSE (EP-15.05).
const path = require("path");
const { getProjects, send, readJsonBody, slugs } = require("../config");
const { createAtelierAgentLoop } = require("../services/atelier-agent-loop.service");
const { buildGeminiModelTurn, buildOpenCodeModelTurn } = require("../services/atelier-engine-adapters.service");
const { loadEnv } = require("../../../tools/lib/env");

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

  const { prompt = "", engine = "gemini", model, effort = "medium", author = "agent", maxTurns } = body || {};

  const projectDir = path.join(getProjects(), slug);
  loadEnv();

  let modelTurn;
  if (engine === "gemini") {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return send(res, 400, { error: "Chave do Gemini (GEMINI_API_KEY) não configurada no ambiente." });
    }
    modelTurn = buildGeminiModelTurn({ key, model: model || "gemini-2.5-flash", effort });
  } else if (engine === "opencode") {
    modelTurn = buildOpenCodeModelTurn({ model, effort });
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

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

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
      onEvent: (event) => emit(event),
    });

    emit({ type: "done", result });
  } catch (err) {
    emit({ type: "error", error: err.message || String(err) });
  } finally {
    try {
      res.end();
    } catch {}
  }
}

module.exports = {
  apiPrototypesAgentRun,
};
