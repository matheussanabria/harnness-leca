// @ts-check
// T2.2: publica o ciclo de vida de cada POST /api/chat no event log EP-09 (ADR-TEL-002/003/004/007).
//
// Uma execucao por requisicao: runId = chatId (cunhado antes do spawn). Somente metadados: nunca
// prompt, historico ou texto de saida no payload. Falha de persistencia nunca quebra nem atrasa
// o chat: captura, conta, loga uma vez e segue (mesmo padrao da ponte de workflow).
//
// Chave de sessao (sessionId do evento), estavel durante toda a execucao:
//   - o sessionId nativo valido enviado pelo cliente (retomada), exceto o id fixo do Ollama;
//   - caso contrario o proprio runId. O id nativo, quando o motor o revela, vai em
//     nativeSessionId (envelope) num session.updated, sem trocar a chave no meio da execucao.
const os = require("os");
const ingest = require("./events/event-ingest");

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const TRACE_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
// Ids de sessao que NAO identificam uma conversa (o motor devolve sempre o mesmo valor).
const FIXED_SESSION_IDS = new Set(["ollama-local"]);
const SOURCE = Object.freeze({ provider: "harness", kind: "chat" });

const stats = { persisted: 0, duplicated: 0, skipped: 0, failed: 0 };
let warned = false;

/** @param {unknown} value @param {number} [max] */
const clip = (value, max = 100) => (typeof value === "string" && value ? value.slice(0, max) : null);

/** @param {string} slug @param {Record<string, any>} body */
function publish(slug, body) {
  try {
    if (!SLUG_PATTERN.test(String(slug || ""))) {
      stats.skipped += 1;
      return false;
    }
    const result = ingest.ingestEvent(slug, { source: SOURCE, projectId: slug, at: new Date().toISOString(), relation: "declared", ...body });
    if (result.duplicated) stats.duplicated += 1;
    else stats.persisted += 1;
    return true;
  } catch (error) {
    stats.failed += 1;
    if (!warned) {
      warned = true;
      const code = /** @type {any} */ (error)?.code || /** @type {any} */ (error)?.name || "Error";
      console.warn(`[chat-run-telemetry] persist failed (${code}); further failures are only counted.`);
    }
    return false;
  }
}

/** @param {unknown} id */
function isUsableNativeId(id) {
  // "hia-*" sao ids sinteticos do despachante HIA (rotas script/local), nao ids nativos do motor.
  return typeof id === "string" && id.length > 0 && id.length <= 200 && !FIXED_SESSION_IDS.has(id) && !id.startsWith("hia-");
}

/** @param {unknown} traceId @param {string} fallback */
function resolveTraceId(traceId, fallback) {
  return typeof traceId === "string" && TRACE_PATTERN.test(traceId) ? traceId : fallback;
}

/** @param {unknown} err @param {string} engine */
function errorCodeOf(err, engine) {
  try {
    const E = require("../../../tools/lib/engines");
    return clip(E.describeError(err, { engine })?.code, 40) || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 429: rejeicao por capacidade. Sem spawn e sem sessao; um unico run.finished com o motivo.
 * @param {{ slug: string, engine?: string, running: number, limit: number, runId: string, traceId?: string }} p
 */
function recordCapacityRejected({ slug, engine, running, limit, runId, traceId }) {
  return publish(slug, {
    type: "run.finished",
    runId,
    executionId: runId,
    traceId: resolveTraceId(traceId, runId),
    engineInstanceId: engineInstanceOf(engine),
    idempotencyKey: `chat|${runId}|run.finished`,
    payload: { status: "rejected", reason: "capacity", engine: clip(engine, 40), running, limit },
  });
}

/** @param {unknown} engine */
function engineInstanceOf(engine) {
  const name = clip(engine, 40);
  return name ? `${name}@${os.hostname()}`.slice(0, 200) : null;
}

/**
 * @param {{ slug: string, engine: string, runId: string, traceId?: string, model?: unknown, effort?: unknown,
 *   sessionId?: unknown }} p
 */
function createChatRunTracker({ slug, engine, runId, traceId, model, effort, sessionId }) {
  const startedAt = Date.now();
  const sessionKey = isUsableNativeId(sessionId) ? String(sessionId) : runId;
  const envelope = {
    runId,
    executionId: runId,
    sessionId: sessionKey,
    traceId: resolveTraceId(traceId, runId),
    engineInstanceId: engineInstanceOf(engine),
  };
  let nativeSessionId = isUsableNativeId(sessionId) ? String(sessionId) : null;
  let finished = false;

  const emit = (type, payload, extra = {}) => publish(slug, { ...envelope, type, payload, ...extra });

  function start() {
    const base = { engine: clip(engine, 40), model: clip(model), effort: clip(effort, 20), resumed: nativeSessionId !== null };
    emit("session.discovered", { provider: clip(engine, 40), kind: "chat" }, { idempotencyKey: `chat|${runId}|session.discovered`, nativeSessionId });
    emit("run.started", base, { idempotencyKey: `chat|${runId}|run.started`, nativeSessionId });
    emit("execution.started", base, { idempotencyKey: `chat|${runId}|execution.started`, nativeSessionId });
  }

  /** @param {any} data chunk do motor (so o campo sessionId e lido) */
  function observe(data) {
    if (finished || nativeSessionId || !isUsableNativeId(data?.sessionId)) return;
    nativeSessionId = String(data.sessionId);
    emit("session.updated", { provider: clip(engine, 40) }, {
      idempotencyKey: `chat|${runId}|session.updated|native`,
      nativeSessionId,
      relation: "native",
    });
  }

  /** @param {"succeeded" | "failed" | "cancelled"} status @param {Record<string, any>} [extra] */
  function finish(status, extra = {}) {
    if (finished) return;
    finished = true;
    const payload = { status, engine: clip(engine, 40), durationMs: Date.now() - startedAt, ...extra };
    const ids = { nativeSessionId };
    emit(`execution.${status}`, payload, { idempotencyKey: `chat|${runId}|execution.${status}`, ...ids });
    emit("run.finished", payload, { idempotencyKey: `chat|${runId}|run.finished`, ...ids });
  }

  /**
   * Envolve o sink do SSE: registra o desfecho antes de entregar ao cliente.
   * @param {{ onChunk: Function, onDone: Function, onError: Function }} sink
   * @param {AbortSignal} [signal]
   */
  function wrapSink(sink, signal) {
    return {
      onChunk: (data) => {
        observe(data);
        return sink.onChunk(data);
      },
      onDone: (data) => {
        observe(data);
        finish("succeeded", { hiaRoute: clip(data?.hiaRoute, 40) || undefined });
        return sink.onDone(data);
      },
      onError: (err) => {
        if (signal?.aborted) finish("cancelled", { reason: "client_disconnected" });
        else finish("failed", { errorCode: errorCodeOf(err, engine) });
        return sink.onError(err);
      },
    };
  }

  /**
   * Conexao SSE fechada. Parar e cair a conexao sao indistinguiveis aqui (sem endpoint de stop).
   * @param {boolean} completed res.writableFinished
   */
  function onClose(completed) {
    if (!completed) finish("cancelled", { reason: "client_disconnected" });
  }

  return { runId, sessionKey, start, observe, finish, wrapSink, onClose };
}

function getChatTelemetryStats() {
  return { ...stats };
}

function resetChatTelemetryStats() {
  Object.assign(stats, { persisted: 0, duplicated: 0, skipped: 0, failed: 0 });
  warned = false;
}

module.exports = { createChatRunTracker, recordCapacityRejected, getChatTelemetryStats, resetChatTelemetryStats };
