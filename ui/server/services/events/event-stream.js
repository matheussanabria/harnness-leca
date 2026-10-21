// @ts-check
// Stream de eventos com recuperacao por cursor (EP-09.02).
//
// Contrato congelado em 10-contrato-leitura-central.md:
//   GET /api/project/:slug/sessions/stream?cursor=<cursor>
// Cada mensagem SSE traz `id: <cursor>`, `event: <tipo canonico>` e `data: <envelope>`.
// Sem cursor, o cliente recebe desde o inicio; com cursor, retoma de onde parou.
const { readEvents, appendEvent, storeStats } = require("./event-store");

const HEARTBEAT_MS = 15000;
const POLL_MS = 1000;
const MAX_BATCH = 200;

/**
 * Serializa um evento no formato SSE.
 * @param {any} event
 * @param {string} cursor
 * @returns {string}
 */
function formatSse(event, cursor) {
  const payload = JSON.stringify(event);
  return `id: ${cursor}\nevent: ${event.type}\ndata: ${payload}\n\n`;
}

/**
 * Envelope de keep-alive: nao e um evento, mas mantem a conexao viva.
 * @param {string} cursor
 * @returns {string}
 */
function formatHeartbeat(cursor) {
  return `: keep-alive ${new Date().toISOString()} cursor=${cursor}\n\n`;
}

/**
 * Cria o stream SSE de um projeto.
 * @param {string} slug
 * @param {{ res: any, cursor?: string, types?: string[], sessionId?: string }} options
 * @returns {{ close: () => void, cursor: () => string }}
 */
function createEventStream(slug, options) {
  const { res } = options;
  let cursor = String(options.cursor || "0");
  let closed = false;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`: stream aberto cursor=${cursor}\n\n`);

  const timer = setInterval(() => {
    if (closed) return;
    try {
      const { events, cursor: next } = readEvents(slug, { cursor, limit: MAX_BATCH, types: options.types, sessionId: options.sessionId });
      for (const event of events) {
        res.write(formatSse(event, next));
      }
      if (events.length) cursor = next;
      else res.write(formatHeartbeat(cursor));
    } catch {
      res.write(formatHeartbeat(cursor));
    }
  }, POLL_MS);

  const heartbeat = setInterval(() => {
    if (!closed) res.write(formatHeartbeat(cursor));
  }, HEARTBEAT_MS);

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    clearInterval(heartbeat);
    try {
      res.end();
    } catch {
      /* conexao ja fechada */
    }
  };

  return { close, cursor: () => cursor };
}

/**
 * Publica um evento no log de um projeto (usado pelos produtores: sessao, execucao, workflow).
 * @param {string} slug
 * @param {any} input
 * @returns {{ event: object, cursor: string, duplicated: boolean }}
 */
function publish(slug, input) {
  return appendEvent(slug, input);
}

/**
 * Resumo do log, para o painel e para o health check.
 * @param {string} slug
 * @returns {object}
 */
function streamStats(slug) {
  return storeStats(slug);
}

module.exports = { createEventStream, publish, streamStats, formatSse, formatHeartbeat, POLL_MS };
