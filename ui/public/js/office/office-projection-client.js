// @ts-check
// Cliente da projeção EP-09 de um projeto: GET /projections + SSE com retomada (T2.3, ADR-TEL-005).
//
// Fluxo: (1) GET projeções -> cursor; (2) EventSource em /sessions/stream?cursor=<cursor>; (3) cada
// evento dobra no mapa de sessões. Qualquer falha (erro do stream, reinício do servidor) fecha o
// stream e recomeça no passo 1 com backoff exponencial: a projeção é a verdade após reconectar,
// então um motor nunca fica "streaming" por um terminal perdido. `stream.reset` (cursor podado)
// também recarrega as projeções. `connected` só é true com projeção carregada E stream aberto.
import { applyEvent, rejectionOf, sessionsFromProjection } from "./office-projection-reducer.js";

export const BACKOFF_MS = Object.freeze({ initial: 1000, max: 30000 });
const HANDLED_TYPES = [
  "session.discovered", "session.updated", "run.started", "run.finished",
  "execution.started", "execution.succeeded", "execution.failed", "execution.cancelled",
  "attention.opened", "attention.acknowledged", "attention.resolved"
];

/**
 * @param {{
 *   slug: string,
 *   onChange: () => void,
 *   fetchImpl?: typeof fetch,
 *   EventSourceImpl?: any,
 *   setTimeoutImpl?: (fn: () => void, ms: number) => any,
 *   clearTimeoutImpl?: (id: any) => void
 * }} options
 */
export function createProjectionClient(options) {
  const { slug, onChange } = options;
  const doFetch = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const ES = options.EventSourceImpl || globalThis.EventSource;
  const later = options.setTimeoutImpl || ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.clearTimeoutImpl || ((id) => clearTimeout(id));
  const base = `/api/project/${encodeURIComponent(slug)}`;

  let sessions = new Map();
  /** @type {Record<string, number>} */
  const rejections = {};
  let connected = false;
  let stopped = false;
  let generation = 0;
  let cursor = 0;
  let delay = BACKOFF_MS.initial;
  let source = null;
  let retryTimer = null;

  const setConnected = (value) => {
    connected = value;
    onChange();
  };

  async function loadProjections(gen) {
    const res = await doFetch(`${base}/projections`);
    if (!res.ok) throw new Error(`projections HTTP ${res.status}`);
    const data = await res.json();
    if (gen !== generation || stopped) return false;
    sessions = sessionsFromProjection(data);
    cursor = Number(data.cursor) || 0;
    return true;
  }

  function closeSource() {
    if (!source) return;
    try { source.close(); } catch { /* já fechado */ }
    source = null;
  }

  function scheduleRetry(gen) {
    if (stopped || gen !== generation) return;
    closeSource();
    if (connected) setConnected(false);
    cancel(retryTimer);
    retryTimer = later(() => { void start(); }, delay);
    delay = Math.min(delay * 2, BACKOFF_MS.max);
  }

  function onMessage(gen, message) {
    if (gen !== generation || stopped) return;
    const id = Number(message.lastEventId);
    if (id && id <= cursor) return; // já refletido na projeção ou duplicado após reconexão
    let event;
    try { event = JSON.parse(message.data); } catch { return; }
    if (id) cursor = id;
    applyEvent(sessions, event);
    const rejected = rejectionOf(event);
    if (rejected) rejections[rejected.engine] = rejected.at;
    onChange();
  }

  function openStream(gen) {
    if (typeof ES !== "function") return scheduleRetry(gen);
    source = new ES(`${base}/sessions/stream?cursor=${cursor}`);
    source.onopen = () => {
      if (gen !== generation || stopped) return;
      delay = BACKOFF_MS.initial;
      setConnected(true);
    };
    source.onerror = () => scheduleRetry(gen);
    for (const type of HANDLED_TYPES) source.addEventListener(type, (message) => onMessage(gen, message));
    source.addEventListener("stream.reset", () => {
      if (gen !== generation || stopped) return;
      closeSource();
      void start();
    });
  }

  async function start() {
    if (stopped) return;
    generation += 1;
    const gen = generation;
    cancel(retryTimer);
    closeSource();
    try {
      if (!(await loadProjections(gen))) return;
    } catch {
      return scheduleRetry(gen);
    }
    openStream(gen);
  }

  function stop() {
    stopped = true;
    generation += 1;
    cancel(retryTimer);
    closeSource();
    connected = false;
  }

  return {
    start,
    stop,
    slug,
    isConnected: () => connected,
    getSessions: () => sessions,
    getRejections: () => ({ ...rejections })
  };
}
