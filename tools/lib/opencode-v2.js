// @ts-check
// Cliente da API HTTP v2 do opencode (`opencode serve` >= 2.0): sessões, prompt, mensagens e modelos.
// Contrato (GET /openapi.json do servidor): rotas sob /api, respostas { data }, mensagens da mais nova para a mais antiga.
// O modelo vai na criação da sessão (ou em /model); o fim do turno é uma mensagem "idle" com outcome e, se falhou, o erro.
const { ocFetch } = require("./opencode-detect");
const { toModelRef } = require("./engines/opencode-model");

class OpenCodeApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) { super(message); this.name = "OpenCodeApiError"; this.status = status; }
}

/**
 * @param {string} base
 * @param {string} method
 * @param {string} route  caminho depois de /api
 * @param {{ body?: object, signal?: AbortSignal, fetchFn?: typeof fetch }} [opts]
 */
async function api(base, method, route, { body, signal, fetchFn = ocFetch } = {}) {
  const res = await fetchFn(`${base.replace(/\/$/, "")}/api${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* corpo não-JSON: o status basta */ }
  if (!res.ok) throw new OpenCodeApiError(res.status, json?.message || `HTTP ${res.status}`);
  return json;
}

/** { providerID, modelID } do harness -> { id, providerID } da API v2. */
const v2Model = (/** @type {string} */ model) => { const r = toModelRef(model); return { id: r.modelID, providerID: r.providerID }; };

/**
 * @param {string} base
 * @param {{ model?: string, agent?: string, permissions?: any }} [session]
 * @param {any} [opts]
 * @returns {Promise<string>} id da sessão (ses_...)
 */
async function createSession(base, { model, agent, permissions } = {}, opts = {}) {
  const body = {};
  if (model) body.model = v2Model(model);
  if (agent) body.agent = agent;
  if (permissions) body.permissions = permissions; // regras { action, resource, effect } valem só para esta sessão
  const out = await api(base, "POST", "/session", { ...opts, body });
  if (!out?.data?.id) throw new OpenCodeApiError(502, "O OpenCode não devolveu o id da sessão.");
  return out.data.id;
}

/** Sessão reaproveitada com outro modelo escolhido na interface. */
async function setSessionModel(base, sessionId, model, opts = {}) {
  await api(base, "POST", `/session/${sessionId}/model`, { ...opts, body: { model: v2Model(model) } });
}

/** Envia o prompt (resposta imediata; a geração segue no servidor). @returns {Promise<{ id: string, created: number }>} */
async function sendPrompt(base, sessionId, text, opts = {}) {
  const out = await api(base, "POST", `/session/${sessionId}/prompt`, { ...opts, body: { text } });
  return { id: out?.data?.id, created: out?.data?.time?.created || 0 };
}

/** Pede ao servidor para interromper a geração (melhor esforço). */
function interrupt(base, sessionId, opts = {}) {
  return api(base, "POST", `/session/${sessionId}/interrupt`, opts).catch(() => {});
}

/**
 * Resume o turno disparado em `since` (time.created do prompt): raciocínio, texto, se acabou e o erro, se houve.
 * `data` vem da mais nova para a mais antiga; vários blocos "assistant" (laços de ferramenta) são concatenados.
 * @param {any[]} data
 * @param {number} since
 */
function summarizeTurn(data, since) {
  const msgs = [...(data || [])].reverse().filter((m) => (m.time?.created || 0) >= since);
  let reasoning = "";
  const texts = [];
  let finish = "";
  let msgError = "";
  for (const m of msgs) {
    if (m.type !== "assistant") continue;
    for (const part of m.content || []) {
      if (part.type === "reasoning" && part.text) reasoning += part.text;
      else if (part.type === "text" && part.text) texts.push(part.text);
    }
    if (m.finish) finish = m.finish;
    if (m.error) msgError = m.error.message || m.error.type || "falha na geração";
  }
  const idle = msgs.find((m) => m.type === "idle");
  const failed = idle?.outcome === "failed";
  const text = texts.join("\n\n");
  let error = failed ? (idle.error?.message || idle.error?.type || msgError || "falha na geração") : msgError;
  if (!error && idle && finish === "length" && !text.trim()) {
    error = "O modelo esgotou a cota máxima de tokens em raciocínio interno antes de produzir a resposta. Simplifique o pedido ou peça uma etapa por vez.";
  }
  return { reasoning, text, done: !!idle, outcome: idle?.outcome || "", error: error || "", finish };
}

/** A sessão ainda está executando no servidor? (GET /api/session/active lista { [id]: { type: "running" } }) */
async function isActive(base, sessionId, opts = {}) {
  const out = await api(base, "GET", "/session/active", opts);
  return Boolean(out?.data && out.data[sessionId]);
}

/** Lê o estado atual do turno que começou em `since`. */
async function readTurn(base, sessionId, since, opts = {}) {
  const out = await api(base, "GET", `/session/${sessionId}/message?limit=100`, opts);
  return summarizeTurn(out?.data, since);
}

/**
 * Modelos do servidor no formato do seletor. O provedor embutido "opencode" fica sem prefixo (como no catálogo);
 * os demais viram "provedor/modelo" (ex.: 9router/Harness), que é o que toModelRef entende.
 * @returns {Promise<Array<{ id: string, name: string, desc: string }>>}
 */
async function listModels(base, opts = {}) {
  const out = await api(base, "GET", "/model", opts);
  const seen = new Set();
  const models = [];
  for (const m of Array.isArray(out?.data) ? out.data : []) {
    const id = m.providerID === "opencode" ? m.modelID : `${m.providerID}/${m.modelID}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const label = m.name || m.modelID;
    const provider = m.providerID === "opencode" ? (id.endsWith("-free") ? "Modelo Gratuito" : "opencode") : m.providerID;
    models.push({ id, name: label, desc: provider });
  }
  return models;
}

module.exports = { api, createSession, setSessionModel, sendPrompt, interrupt, isActive, summarizeTurn, readTurn, listModels, OpenCodeApiError };
