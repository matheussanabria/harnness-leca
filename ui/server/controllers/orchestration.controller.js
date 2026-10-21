// @ts-check
// Controller da API de Observabilidade e Streaming do Centro de Orquestração M2
const { send, readJsonBody, HEADERS, slugs } = require("../config");
const { eventEngine } = require("../services/orchestration/event-engine");
const { pollAllSources } = require("../services/orchestration/orchestration-collector");
const procManager = require("../../../tools/lib/proc-manager");
const routines = require("../../../tools/lib/routines");
const syncCore = require("../../../tools/lib/sync-core");
const crypto = require("node:crypto");

/**
 * GET /api/orchestration/state
 * Retorna o estado consolidado atual (agentes, execuções, integrações)
 */
function apiOrchestrationState({ res, url }) {
  const projectId = url.searchParams.get("projectId") || undefined;
  // Faz uma rodada rápida de coleta para garantir dados atualizados
  pollAllSources(projectId);
  return send(res, 200, eventEngine.getState(projectId));
}

/**
 * GET /api/orchestration/events
 * Retorna histórico de eventos canônicos com filtros
 */
function apiOrchestrationEvents({ res, url }) {
  const filter = {
    projectId: url.searchParams.get("projectId") || undefined,
    executionId: url.searchParams.get("executionId") || undefined,
    agentId: url.searchParams.get("agentId") || undefined,
    type: url.searchParams.get("type") || undefined,
    limit: Number(url.searchParams.get("limit") || 50),
    since: url.searchParams.get("since") || undefined
  };
  return send(res, 200, { events: eventEngine.getEvents(filter) });
}

/**
 * GET /api/orchestration/executions/:id
 * Inspeciona uma execução específica
 */
function apiOrchestrationExecutionDetail({ res, params: [id] }) {
  if (!id) return send(res, 400, { error: "ID de execução obrigatório" });
  const state = eventEngine.getState();
  const exec = state.executions.find(e => e.id === id);
  if (!exec) return send(res, 404, { error: "Execução não encontrada" });

  const events = eventEngine.getEvents({ executionId: id, limit: 100 });
  return send(res, 200, { execution: exec, events });
}

/**
 * GET /api/orchestration/stream
 * Conexão SSE em tempo real com eventos incrementais e heartbeat
 */
function apiOrchestrationStream({ req, res, url }) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...HEADERS
  });

  const projectId = url.searchParams.get("projectId") || undefined;

  // Envia estado inicial imediatamente
  pollAllSources(projectId);
  const initialState = eventEngine.getState(projectId);
  res.write(`event: state\ndata: ${JSON.stringify(initialState)}\n\n`);

  // Listener para novos eventos
  const onNewEvent = (/** @type {import('../services/orchestration/event-contract').HarnessEvent} */ event) => {
    if (projectId && event.projectId && event.projectId !== projectId) return;
    try {
      res.write(`event: event\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {}
  };

  eventEngine.on("event", onNewEvent);

  // Heartbeat a cada 15 segundos para manter a conexão viva e verificar fontes
  const heartbeatTimer = setInterval(() => {
    try {
      pollAllSources(projectId);
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatTimer);
    eventEngine.off("event", onNewEvent);
  });
}

/**
 * POST /api/orchestration/operations
 * Dispara ações operacionais suportadas com validação e rastreabilidade
 */
async function apiOrchestrationOperation({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }

  const { action, target, parameters } = body || {};
  if (!action || !target) {
    return send(res, 400, { error: "Campos 'action' e 'target' são obrigatórios" });
  }

  const opId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  // 1. Operação: Iniciar Serviço de Desenvolvimento
  if (action === "service.start") {
    const { slug, serviceId } = target;
    if (!slug || !serviceId) return send(res, 400, { error: "slug e serviceId são obrigatórios" });
    if (!slugs().includes(slug)) return send(res, 404, { error: "Projeto não encontrado" });

    const result = await procManager.startService(slug, serviceId);
    return send(res, result.ok ? 200 : 500, {
      operationId: opId,
      action,
      requestedAt,
      status: result.ok ? "completed" : "failed",
      result
    });
  }

  // 2. Operação: Parar Serviço de Desenvolvimento
  if (action === "service.stop") {
    const { slug, serviceId } = target;
    if (!slug || !serviceId) return send(res, 400, { error: "slug e serviceId são obrigatórios" });

    const result = procManager.stopService(slug, serviceId);
    return send(res, 200, {
      operationId: opId,
      action,
      requestedAt,
      status: "completed",
      result
    });
  }

  // 3. Operação: Disparar Rotina Agendada
  if (action === "routine.trigger" || action === "trigger_routine") {
    const slug = target.slug || target.projectId;
    const routineFile = target.routineFile || parameters?.routineId || parameters?.routineFile || "extrair-pendentes.md";
    if (!slug) return send(res, 400, { error: "slug ou projectId é obrigatório" });
    if (!slugs().includes(slug)) return send(res, 404, { error: "Projeto não encontrado" });

    // Dispara a rotina em segundo plano para não travar a resposta HTTP
    setImmediate(() => {
      try {
        routines.runProject(slug, { only: routineFile });
      } catch (err) {
        console.error("[routines/async-trigger]", err.message);
      }
    });

    return send(res, 200, {
      operationId: opId,
      action,
      requestedAt,
      status: "completed",
      result: {
        message: `Rotina '${routineFile}' disparada com sucesso em segundo plano para o projeto '${slug}'`,
        routineFile,
        slug
      }
    });
  }

  // 4. Operação: Sincronizar Projeto (Execução real de syncCore)
  if (action === "project.sync" || action === "sync_project") {
    const slug = target.slug || target.projectId;
    if (!slug) return send(res, 400, { error: "slug ou projectId é obrigatório" });
    if (!slugs().includes(slug)) return send(res, 404, { error: "Projeto não encontrado" });

    try {
      const syncResult = syncCore.syncProject({ slug, engines: ["claude", "gemini", "opencode"] });
      return send(res, 200, {
        operationId: opId,
        action,
        requestedAt,
        status: "completed",
        result: {
          message: `Sincronização concluída com sucesso para o projeto '${slug}'`,
          details: syncResult,
          slug
        }
      });
    } catch (err) {
      return send(res, 500, {
        operationId: opId,
        action,
        requestedAt,
        status: "failed",
        error: err.message
      });
    }
  }

  return send(res, 400, {
    operationId: opId,
    status: "rejected",
    error: `Ação operacional '${action}' não suportada ou não permitida`
  });
}

module.exports = {
  apiOrchestrationState,
  apiOrchestrationEvents,
  apiOrchestrationExecutionDetail,
  apiOrchestrationStream,
  apiOrchestrationOperation
};
