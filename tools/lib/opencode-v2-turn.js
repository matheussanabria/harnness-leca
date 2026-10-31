// @ts-check
// Um turno completo na API v2 do opencode, com streaming: assina GET /api/event (session.reasoning.delta e
// session.text.delta), envia o prompt e acompanha até session.execution.* terminar.
//
// Por que não só ler /message: a v2 só põe o conteúdo ali quando o passo termina, e o modelo pode ficar ~1 min sem
// emitir nada. Silêncio não é morte: enquanto a sessão estiver em GET /api/session/active ela segue viva.
// Leitura periódica de /message fica como rede de segurança (SSE caiu, upstream sem streaming, erro final).
const V2 = require("./opencode-v2");
const { ocFetch } = require("./opencode-detect");

class TurnError extends Error {
  /** @param {string} message */
  constructor(message) { super(message); this.name = "TurnError"; }
}

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const IDLE_MS = 180_000; // sem evento, sem conteúdo e sem a sessão ativa no servidor
const MAX_MS = 900_000; // teto absoluto de segurança

/**
 * Assina os eventos da sessão. `state.ended` vira { outcome, error } no fim da execução.
 * @param {string} base
 * @param {string} sessionId
 * @param {{ onReasoning: (d: string) => void, onText: (d: string) => void, fetchFn?: typeof fetch }} h
 */
function watchEvents(base, sessionId, { onReasoning, onText, fetchFn = ocFetch }) {
  const ac = new AbortController();
  const state = { connected: false, lastEvent: Date.now(), /** @type {null | { outcome: string, error: string }} */ ended: null };
  let markReady = () => {};
  const ready = new Promise((r) => { markReady = () => r(undefined); setTimeout(markReady, 2000); });

  const handle = (/** @type {any} */ e) => {
    if (e.type === "server.connected") { state.connected = true; markReady(); return; }
    if (e.data?.sessionID !== sessionId) return;
    state.lastEvent = Date.now();
    if (e.type === "session.reasoning.delta" && e.data.delta) onReasoning(e.data.delta);
    else if (e.type === "session.text.delta" && e.data.delta) onText(e.data.delta);
    else if (/^session\.execution\.(?!started)/.test(e.type)) {
      const outcome = e.type.slice("session.execution.".length);
      state.ended = { outcome, error: outcome === "failed" ? (e.data.error?.message || e.data.error?.type || "falha na geração") : "" };
    }
  };

  (async () => {
    try {
      const res = await fetchFn(`${base.replace(/\/$/, "")}/api/event`, { signal: ac.signal });
      if (!res.ok || !res.body) { markReady(); return; }
      const dec = new TextDecoder();
      let buf = "";
      for await (const chunk of /** @type {any} */ (res.body)) {
        buf += dec.decode(chunk, { stream: true });
        const parts = buf.split("\n\n");
        buf = /** @type {string} */ (parts.pop());
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try { handle(JSON.parse(line.slice(6))); } catch { /* evento ilegível: ignora */ }
        }
      }
    } catch { /* SSE caiu ou foi fechado: o polling de /message cobre */ }
    state.connected = false;
    markReady();
  })();

  return { state, ready, close: () => ac.abort() };
}

/** Prefixo comum: o catch-up só vale se o que já chegou por SSE for começo do texto lido. */
const tail = (/** @type {string} */ full, /** @type {string} */ have) => (full.length > have.length && full.startsWith(have) ? full.slice(have.length) : "");

/**
 * @param {string} base
 * @param {string} sessionId
 * @param {string} text
 * @param {{ signal?: AbortSignal, onReasoning?: (d: string) => void, onText?: (d: string) => void, onWaiting?: (silentSeconds: number) => void, fetchFn?: typeof fetch, tickMs?: number, syncMs?: number, idleMs?: number, maxMs?: number, waitingMs?: number }} [o]
 * @returns {Promise<{ text: string, reasoning: string, aborted: boolean, finish: string }>}
 */
async function runTurn(base, sessionId, text, o = {}) {
  const { signal, onReasoning = () => {}, onText = () => {}, onWaiting = () => {}, fetchFn = ocFetch, tickMs = 300, syncMs = 3000, idleMs = IDLE_MS, maxMs = MAX_MS, waitingMs = 10_000 } = o;
  const req = { fetchFn };
  let reasoning = "";
  let out = "";
  let finish = ""; // last finish reason read from /message ("stop", "length", ...), for the quality gate
  const pushR = (/** @type {string} */ d) => { if (d) { reasoning += d; onReasoning(d); } };
  const pushT = (/** @type {string} */ d) => { if (d) { out += d; onText(d); } };

  const live = watchEvents(base, sessionId, { onReasoning: pushR, onText: pushT, fetchFn });
  try {
    await live.ready;
    const sent = await V2.sendPrompt(base, sessionId, text, req);
    const start = Date.now();
    let lastSync = 0;
    let lastSeen = Date.now();
    let lastWaiting = 0;

    for (;;) {
      await sleep(tickMs);
      if (signal?.aborted) {
        V2.interrupt(base, sessionId, req);
        return { text: out, reasoning, aborted: true, finish };
      }
      const now = Date.now();
      lastSeen = Math.max(lastSeen, live.state.lastEvent);
      const ended = live.state.ended;

      /** @type {Awaited<ReturnType<typeof V2.readTurn>> | null} */
      let turn = null;
      if (ended || !live.state.connected || now - lastSync >= syncMs) {
        lastSync = now;
        try {
          turn = await V2.readTurn(base, sessionId, sent.created, req);
        } catch (err) {
          if (!(err instanceof V2.OpenCodeApiError)) throw err; // falha momentânea de leitura: tenta de novo
        }
        if (turn) {
          if (turn.finish) finish = turn.finish;
          const r = tail(turn.reasoning, reasoning);
          const t = tail(turn.text, out);
          if (r || t) lastSeen = now;
          pushR(r);
          pushT(t);
        }
      }

      const failure = ended?.outcome === "failed" ? ended.error : turn?.error;
      if (failure) throw new TurnError(`OpenCode erro: ${failure}`);
      if (ended || turn?.done) return { text: out, reasoning, aborted: false, finish };

      // Modelos lentos (ex.: ~14 tok/s, sem streaming no upstream) ficam minutos mudos: avisa que a sessão segue viva.
      if (now - lastSeen >= waitingMs && now - lastWaiting >= waitingMs) {
        lastWaiting = now;
        onWaiting(Math.round((now - lastSeen) / 1000));
      }
      if (now - start > maxMs) throw new TurnError("Tempo limite total excedido aguardando resposta do OpenCode (15 minutos)");
      if (now - lastSeen > idleMs) {
        const active = await V2.isActive(base, sessionId, req).catch(() => false);
        if (!active) throw new TurnError("Tempo limite de inatividade excedido (OpenCode sem novos dados por mais de 3 minutos)");
        lastSeen = now; // o modelo ainda está trabalhando, só não emitiu nada
      }
    }
  } finally {
    live.close();
  }
}

module.exports = { runTurn, watchEvents, TurnError };
