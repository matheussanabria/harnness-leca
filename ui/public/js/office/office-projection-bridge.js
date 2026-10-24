// @ts-check
// Ponte projeção EP-09 -> estado dos agentes do Escritório (T2.3). Ver regra em office-telemetry-source.js.
import { AGENT_KEYS, officeAgentState } from "./office-agent-state.js";
import { createProjectionClient } from "./office-projection-client.js";
import { deriveEngineStates, ERROR_TTL_MS, REJECTED_TTL_MS } from "./office-projection-reducer.js";
import { setServerTruth } from "./office-telemetry-source.js";

/**
 * Liga o projeto ativo do Escritório à projeção do servidor e acompanha a troca de projeto.
 * @param {{ activeProject?: string, subscribe?: Function, listeners?: Function[] }} state
 * @param {{ onFallback?: () => void, createClient?: typeof createProjectionClient, now?: () => number }} [deps]
 *   onFallback: recalcula o estado local quando o stream cai.
 * @returns {() => void}
 */
export function bindProjectionTelemetry(state, deps = {}) {
  if (!state || typeof state.subscribe !== "function") return () => {};
  const makeClient = deps.createClient || createProjectionClient;
  const now = deps.now || Date.now;
  let client = null;
  let timer = null;

  const apply = () => {
    if (!client) return;
    clearTimeout(timer);
    if (!client.isConnected()) {
      setServerTruth(false);
      // Sessões abertas só existem na projeção: sem stream não afirmamos nenhuma.
      for (const engine of AGENT_KEYS) officeAgentState.setAgentState(engine, { openCount: 0 });
      deps.onFallback?.();
      return;
    }
    setServerTruth(true);
    const derived = deriveEngineStates(client.getSessions(), { now: now(), engines: AGENT_KEYS, rejections: client.getRejections() });
    for (const engine of AGENT_KEYS) officeAgentState.setAgentState(engine, derived[engine]);
    // Erro e aviso de rejeição são transitórios: reavalia quando expiram.
    timer = setTimeout(apply, Math.min(ERROR_TTL_MS, REJECTED_TTL_MS) + 50);
  };

  const follow = () => {
    const slug = state.activeProject || "";
    if (client && client.slug === slug) return;
    client?.stop();
    client = null;
    setServerTruth(false);
    if (!slug) return;
    client = makeClient({ slug, onChange: apply });
    void client.start();
  };

  state.subscribe(follow);
  follow();
  return () => {
    clearTimeout(timer);
    client?.stop();
    client = null;
    setServerTruth(false);
    if (Array.isArray(state.listeners)) {
      const index = state.listeners.indexOf(follow);
      if (index >= 0) state.listeners.splice(index, 1);
    }
  };
}
