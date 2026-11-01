// @ts-check
// Assinatura do stream SSE da 09.02 com cursor, reconexão e indicador de desconexão (EP-09.04, RF7 e RF8).
// Módulo de infraestrutura cliente desacoplado do DOM.

/**
 * @typedef {Object} LiveClientOptions
 * @property {string} slug
 * @property {string} [baseUrl=""]
 * @property {string} [initialCursor=""]
 * @property {number} [retryDelayMs=3000]
 * @property {number} [maxRetryDelayMs=30000]
 * @property {typeof EventSource} [eventSourceImpl]
 * @property {Function} [onEvent] (event: any) => void
 * @property {Function} [onStatusChange] (status: LiveStatus) => void
 */

/**
 * @typedef {Object} LiveStatus
 * @property {"connected" | "connecting" | "disconnected"} state
 * @property {string} cursor
 * @property {string} lastUpdatedAt
 * @property {number} retryCount
 * @property {string} [error]
 */

/**
 * Cria uma assinatura SSE recuperável para a Central de Sessões.
 * @param {LiveClientOptions} options
 * @returns {{
 *   connect: () => void,
 *   disconnect: () => void,
 *   getStatus: () => LiveStatus,
 *   getCursor: () => string
 * }}
 */
export function createCentralLiveSubscription(options) {
  const {
    slug,
    baseUrl = "",
    retryDelayMs = 3000,
    maxRetryDelayMs = 30000,
    onEvent = () => {},
    onStatusChange = () => {},
  } = options;

  let cursor = String(options.initialCursor || "");
  let lastUpdatedAt = "";
  let retryCount = 0;
  let active = false;
  /** @type {any} */
  let es = null;
  /** @type {any} */
  let reconnectTimer = null;

  /** @type {LiveStatus} */
  let currentStatus = {
    state: "disconnected",
    cursor,
    lastUpdatedAt,
    retryCount: 0,
  };

  function updateStatus(patch) {
    currentStatus = { ...currentStatus, ...patch, cursor, lastUpdatedAt };
    onStatusChange(currentStatus);
  }

  function connect() {
    disconnect();
    active = true;
    updateStatus({ state: "connecting" });

    const EventSourceClass = options.eventSourceImpl || (typeof EventSource !== "undefined" ? EventSource : null);
    if (!EventSourceClass) {
      updateStatus({ state: "disconnected", error: "EventSource indisponível no ambiente" });
      return;
    }

    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    const url = `${baseUrl}/api/project/${encodeURIComponent(slug)}/sessions/stream${query.toString() ? `?${query.toString()}` : ""}`;

    try {
      es = new EventSourceClass(url);

      es.onopen = () => {
        retryCount = 0;
        updateStatus({ state: "connected", retryCount: 0, error: undefined });
      };

      es.onmessage = (e) => {
        if (!e?.data) return;
        try {
          const envelope = JSON.parse(e.data);
          if (envelope?.id || envelope?.cursor) {
            cursor = String(envelope.cursor || envelope.id);
          }
          lastUpdatedAt = new Date().toISOString();
          updateStatus({ lastUpdatedAt });
          onEvent(envelope);
        } catch {}
      };

      // Suporte a eventos customizados transmitidos pelo servidor
      const eventTypes = ["session.discovered", "session.updated", "execution.started", "execution.completed", "workflow.approval_requested"];
      for (const evtName of eventTypes) {
        es.addEventListener(evtName, (e) => {
          if (!e?.data) return;
          try {
            const envelope = JSON.parse(e.data);
            if (e.lastEventId) cursor = String(e.lastEventId);
            else if (envelope?.cursor) cursor = String(envelope.cursor);
            lastUpdatedAt = new Date().toISOString();
            updateStatus({ lastUpdatedAt });
            onEvent(envelope);
          } catch {}
        });
      }

      es.onerror = () => {
        if (!active) return;
        disconnectInternal();
        retryCount++;
        const backoff = Math.min(retryDelayMs * Math.pow(1.5, retryCount - 1), maxRetryDelayMs);
        updateStatus({ state: "disconnected", retryCount, error: "Conexão SSE interrompida" });
        reconnectTimer = setTimeout(() => {
          if (active) connect();
        }, backoff);
      };
    } catch (err) {
      updateStatus({ state: "disconnected", error: String(err?.message || err) });
    }
  }

  function disconnectInternal() {
    if (es) {
      try {
        es.close();
      } catch {}
      es = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function disconnect() {
    active = false;
    disconnectInternal();
    updateStatus({ state: "disconnected" });
  }

  return {
    connect,
    disconnect,
    getStatus: () => currentStatus,
    getCursor: () => cursor,
  };
}

/**
 * Renderiza o indicador de status do stream SSE com horário da última atualização (RF8).
 * @param {LiveStatus} status
 * @returns {string}
 */
export function renderLiveStatusBadge(status) {
  if (!status) return "";
  const time = status.lastUpdatedAt
    ? new Date(status.lastUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "nenhuma";

  if (status.state === "connected") {
    return `<span class="central-live-badge central-live-badge--connected" title="Stream ao vivo conectado · Cursor: ${status.cursor || "0"}">
      <i class="fa-solid fa-circle-dot" aria-hidden="true"></i> Ao vivo
    </span>`;
  }

  if (status.state === "connecting") {
    return `<span class="central-live-badge central-live-badge--connecting" title="Reconectando ao stream...">
      <i class="fa-solid fa-arrows-rotate fa-spin" aria-hidden="true"></i> Conectando...
    </span>`;
  }

  return `<span class="central-live-badge central-live-badge--disconnected" title="SSE desconectado. Última atualização: ${time}">
    <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Desconectado (${time})
  </span>`;
}
