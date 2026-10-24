// @ts-check
// Reducer puro da projeção EP-09 para o estado por motor do Escritório (T2.3, ADR-TEL-005).
//
// Espelha, no cliente, a regra do projetor do servidor (event-projector.js): um status de execução
// por sessão, a execução mais recente assume e estado terminal nunca regride para "running".
// Sem DOM, sem rede, sem relógio global: `now` entra por parâmetro para ser testável.

/** Execução "running" sem nenhum evento há mais que isto é tratada como órfã (servidor reiniciado). */
export const STALE_RUNNING_MS = 2 * 60 * 60 * 1000;
/** Quanto tempo um erro recente aparece como status "error" quando nada mais roda no motor. */
export const ERROR_TTL_MS = 30 * 1000;
/** Quanto tempo uma rejeição por capacidade (429) aparece como aviso transitório. */
export const REJECTED_TTL_MS = 10 * 1000;

/**
 * Sessão externa "processing" sem nenhum evento há mais que isto deixa de contar como trabalhando
 * (scanner parado ou servidor reiniciado): sem sinal fresco não afirmamos atividade (design 06).
 */
export const EXTERNAL_PROCESSING_STALE_MS = 5 * 60 * 1000;

const ACTIVITIES = new Set(["processing", "idle", "unknown"]);
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);
const STATUS_BY_TYPE = Object.freeze({
  "execution.started": "running",
  "execution.succeeded": "succeeded",
  "execution.failed": "failed",
  "execution.cancelled": "cancelled"
});

/**
 * @typedef {{ provider: string | null, execId: string, status: string | null, at: number, attention: string | null,
 *   origin: string | null, activity: string | null, presence: string | null, nativeId: string | null, signalAt: number }} SessionEntry
 * @typedef {{ engine: string, at: number }} Rejection
 */

const toMs = (value) => {
  const ms = Date.parse(String(value || ""));
  return Number.isNaN(ms) ? 0 : ms;
};

const text = (value) => (value ? String(value) : null);
const newEntry = () => ({ provider: null, execId: "", status: null, at: 0, attention: null, origin: null, activity: null, presence: null, nativeId: null, signalAt: 0 });

/**
 * Campos de presença/atividade vindos de um servidor mais antigo podem faltar ou ser inesperados:
 * valor fora do vocabulário vira null, e null nunca conta como "trabalhando".
 * @param {SessionEntry} entry
 * @param {any} fields origin/activity/presence/nativeSessionId
 * @param {number} at instante da ocorrência (a mais recente vence)
 */
function foldPresence(entry, fields, at) {
  if (fields.nativeSessionId) entry.nativeId = String(fields.nativeSessionId);
  if (fields.origin) entry.origin = String(fields.origin);
  const hasSignal = fields.activity !== undefined || fields.presence !== undefined;
  if (!hasSignal || at < entry.signalAt) return;
  entry.signalAt = at;
  if (fields.activity !== undefined) entry.activity = ACTIVITIES.has(fields.activity) ? fields.activity : null;
  if (fields.presence !== undefined) entry.presence = text(fields.presence);
}

/**
 * Constrói o mapa de sessões a partir de `GET /projections` (substitui o estado inteiro).
 * @param {{ sessions?: any[] }} [projection]
 * @returns {Map<string, SessionEntry>}
 */
export function sessionsFromProjection(projection) {
  const map = new Map();
  for (const view of projection?.sessions || []) {
    if (!view?.sessionId) continue;
    const entry = newEntry();
    entry.provider = text(view.provider || view.engine);
    entry.status = view.executionStatus || null;
    entry.at = toMs(view.lastEventAt);
    entry.attention = view.attentionStatus || null;
    foldPresence(entry, view, toMs(view.lastActivityAt || view.lastSeenAt || view.lastEventAt));
    map.set(String(view.sessionId), entry);
  }
  return map;
}

/**
 * Dobra um evento do stream no mapa de sessões (muta o mapa).
 * @param {Map<string, SessionEntry>} sessions
 * @param {any} event envelope canônico
 */
export function applyEvent(sessions, event) {
  const type = String(event?.type || "");
  const id = String(event?.sessionId || "");
  if (!id) return;
  let entry = sessions.get(id);
  if (!entry) {
    entry = newEntry();
    sessions.set(id, entry);
  }
  const at = toMs(event.at);
  if (at > entry.at) entry.at = at;
  const payload = event.payload || {};
  if (type === "session.discovered" || type === "session.updated") {
    const provider = payload.provider || payload.engine;
    if (type === "session.discovered" && provider) entry.provider = String(provider);
    else if (provider && !entry.provider) entry.provider = String(provider);
    foldPresence(entry, { ...payload, nativeSessionId: event.nativeSessionId }, at);
  } else if (event.nativeSessionId) {
    entry.nativeId = String(event.nativeSessionId);
  }
  if (type === "attention.opened") entry.attention = "open";
  if (type === "attention.resolved" || type === "attention.acknowledged") entry.attention = "resolved";
  const status = STATUS_BY_TYPE[type];
  if (!status) return;
  const execId = String(event.executionId || "");
  if (status === "running") {
    // Terminal da mesma execução não regride; outra execução da sessão assume ao iniciar.
    if (entry.execId === execId && TERMINAL.has(String(entry.status))) return;
    entry.execId = execId;
    entry.status = "running";
    if (event.payload?.engine && !entry.provider) entry.provider = String(event.payload.engine);
  } else if (!entry.execId || entry.execId === execId || entry.status === null) {
    entry.execId = execId;
    entry.status = status;
  }
}

/**
 * Extrai uma rejeição por capacidade (429) de um evento, ou null.
 * @param {any} event
 * @returns {Rejection | null}
 */
export function rejectionOf(event) {
  if (event?.type !== "run.finished" || event?.payload?.status !== "rejected") return null;
  const engine = String(event.payload?.engine || "");
  return engine ? { engine, at: toMs(event.at) || Date.now() } : null;
}

const keyOf = (id, entry) => entry.nativeId || id;
const isFreshRun = (entry, now) => entry.status === "running" && now - entry.at <= STALE_RUNNING_MS;
const isExternal = (entry) => entry.origin === "external";

/**
 * Estado por motor derivado da projeção (regra do Escritório, design 06):
 *   activeCount = execuções Harness "running" + sessões externas com activity "processing", sem contar
 *                 duas vezes a sessão externa que também é uma execução Harness (mesmo id nativo);
 *   openCount   = sessões externas conectadas e não processando (abertas, não trabalhando).
 * Campos ausentes (servidor antigo) nunca contam como trabalhando. Mesma semântica de T0.1:
 * waiting_approval > streaming > (erro recente) > idle; erro nunca esconde execuções em andamento.
 * @param {Map<string, SessionEntry>} sessions
 * @param {{ now: number, engines: readonly string[], rejections?: Record<string, number> }} options
 * @returns {Record<string, { status: string, activeCount: number, openCount: number, currentTask: string }>}
 */
export function deriveEngineStates(sessions, { now, engines, rejections = {} }) {
  /** @type {Record<string, { running: number, external: number, open: number, waiting: number, lastFailedAt: number }>} */
  const acc = {};
  for (const engine of engines) acc[engine] = { running: 0, external: 0, open: 0, waiting: 0, lastFailedAt: 0 };
  /** @type {Set<string>} */
  const harnessKeys = new Set();
  for (const [id, entry] of sessions) {
    const slot = entry.provider ? acc[entry.provider] : null;
    if (!slot) continue;
    if (isFreshRun(entry, now)) {
      slot.running += 1;
      harnessKeys.add(`${entry.provider}|${keyOf(id, entry)}`);
      if (entry.attention === "open") slot.waiting += 1;
    } else if (entry.status === "failed") {
      slot.lastFailedAt = Math.max(slot.lastFailedAt, entry.at);
    }
  }
  for (const [id, entry] of sessions) {
    const slot = entry.provider ? acc[entry.provider] : null;
    if (!slot || !isExternal(entry) || isFreshRun(entry, now)) continue;
    if (entry.activity === "processing" && now - entry.at <= EXTERNAL_PROCESSING_STALE_MS) {
      if (!harnessKeys.has(`${entry.provider}|${keyOf(id, entry)}`)) slot.external += 1;
    } else if (entry.presence === "connected" && entry.activity !== "processing") {
      slot.open += 1;
    }
  }
  /** @type {Record<string, { status: string, activeCount: number, openCount: number, currentTask: string }>} */
  const out = {};
  for (const engine of engines) {
    const { running, external, open, waiting, lastFailedAt } = acc[engine];
    const total = running + external;
    if (total > 0) {
      const status = waiting > 0 ? "waiting_approval" : "streaming";
      const single = running === 0 ? "Sessão externa processando" : `Execução ${status}`;
      out[engine] = { status, activeCount: total, openCount: open, currentTask: total > 1 ? `${total} execuções ativas` : single };
    } else if (lastFailedAt && now - lastFailedAt <= ERROR_TTL_MS) {
      out[engine] = { status: "error", activeCount: 0, openCount: open, currentTask: "" };
    } else {
      const rejected = rejections[engine] && now - rejections[engine] <= REJECTED_TTL_MS;
      out[engine] = { status: "idle", activeCount: 0, openCount: open, currentTask: rejected ? "Execução rejeitada: capacidade esgotada" : "" };
    }
  }
  return out;
}
