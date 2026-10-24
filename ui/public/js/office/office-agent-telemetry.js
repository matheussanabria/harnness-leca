// @ts-check
// Ponte de telemetria entre execuções reais e o estado canônico dos agentes (EP-03.05).
import { AGENT_KEYS, STATUS_THEMES, officeAgentState } from "./office-agent-state.js";
import { countActiveByEngine, subscribeAllChatExecutions } from "../modules/chat-execution-store.js";
import { isServerTruth } from "./office-telemetry-source.js";

const CHAT_STATUS = Object.freeze({
  idle: "idle",
  streaming: "streaming",
  waiting_approval: "waiting_approval",
  cancelled: "idle",
  error: "error"
});

const ACTIVITY_STATUS = Object.freeze({
  active: "thinking",
  thinking: "thinking",
  streaming: "streaming",
  waiting_approval: "waiting_approval",
  error: "error",
  offline: "offline",
  idle: "idle"
});

const TRANSIENT = new Set(["streaming", "waiting_approval"]);

/**
 * Traduz o estado de execução do chat para o estado canônico do agente.
 * @param {string} [status]
 * @returns {string}
 */
export function mapChatExecutionStatus(status) {
  return CHAT_STATUS[status] || "idle";
}

/**
 * Escolhe a pose 3D coerente com o estado do agente.
 * @param {string} status
 * @returns {"typing" | "sit"}
 */
export function avatarStateFor(status) {
  return status === "streaming" || status === "thinking" ? "typing" : "sit";
}

/**
 * Cor do pad luminoso da estação 3D para o estado atual.
 * @param {string} status
 * @returns {string}
 */
export function padColorFor(status) {
  return (STATUS_THEMES[status] || STATUS_THEMES.idle).color;
}

/**
 * Aplica uma execução de chat ao agente responsável.
 * @param {string} agentKey
 * @param {{ status?: string, errorMessage?: string }} [snapshot]
 */
export function syncAgentFromChatExecution(agentKey, snapshot = {}) {
  if (!AGENT_KEYS.includes(agentKey)) return null;
  const status = mapChatExecutionStatus(snapshot.status);
  const working = status === "streaming" || status === "thinking" || status === "waiting_approval";
  return officeAgentState.setAgentState(agentKey, {
    status,
    activeCount: working ? 1 : 0,
    currentTask: working ? (snapshot.errorMessage || `Execução ${status}`) : ""
  });
}

/**
 * Sincroniza o resumo de atividade dos motores, sem sobrescrever estados transitórios do chat.
 * @param {{ agents?: Record<string, any> }} [activeAgents]
 */
export function syncAgentsFromActivity(activeAgents = {}) {
  // Com o stream do servidor conectado, a projeção é a fonte (office-telemetry-source.js).
  if (isServerTruth()) return;
  const agents = activeAgents.agents || {};
  for (const key of AGENT_KEYS) {
    const agent = agents[key];
    if (!agent) continue;
    const current = officeAgentState.getAgentState(key);
    if (TRANSIENT.has(current.status)) continue;
    const count = Number(agent.activeCount) || 0;
    officeAgentState.setAgentState(key, {
      status: ACTIVITY_STATUS[agent.status] || (count > 0 ? "thinking" : "idle"),
      activeCount: count,
      currentTask: agent.currentTask || ""
    });
  }
}

/**
 * Recalcula um motor a partir de TODOS os chats em execução (não só do snapshot que mudou).
 * Ocupado enquanto count > 0; erro só aparece se nenhum outro chat do motor estiver rodando.
 * @param {string} engine
 * @param {{ status?: string, errorMessage?: string, currentEngine?: string }} snapshot
 */
function recomputeEngine(engine, snapshot) {
  const { count, waitingApproval } = countActiveByEngine(engine);
  if (count > 0) {
    const status = waitingApproval > 0 ? "waiting_approval" : "streaming";
    officeAgentState.setAgentState(engine, {
      status,
      activeCount: count,
      currentTask: count > 1 ? `${count} execuções ativas` : `Execução ${status}`
    });
    return;
  }
  const triggered = snapshot.currentEngine === engine;
  const current = officeAgentState.getAgentState(engine);
  if (!triggered && !TRANSIENT.has(current.status)) return;
  const status = triggered ? mapChatExecutionStatus(snapshot.status) : "idle";
  officeAgentState.setAgentState(engine, {
    status: TRANSIENT.has(status) ? "idle" : status,
    activeCount: 0,
    currentTask: ""
  });
}

/**
 * Recalcula todos os motores a partir do store local (usado quando o stream do servidor cai).
 */
export function recomputeLocalEngines() {
  for (const engine of AGENT_KEYS) recomputeEngine(engine, {});
}

/**
 * Liga as execuções de chat ao estado dos agentes.
 * Compare mode: o snapshot traz currentEngine "compare" (fora de AGENT_KEYS); os motores
 * comparados vêm das chaves de controllers no store, então todos os motores são recalculados.
 * Limitação: contagem é local ao documento (não enxerga chats de outras abas); por isso só vale
 * como fallback: com o stream do servidor conectado (T2.3), o listener abaixo não escreve nada.
 * @returns {() => void}
 */
export function bindChatExecutionTelemetry() {
  return subscribeAllChatExecutions((snapshot) => {
    if (isServerTruth() || !snapshot || !snapshot.currentEngine) return;
    for (const engine of AGENT_KEYS) recomputeEngine(engine, snapshot);
  });
}

/**
 * Liga o resumo periódico de atividade do Escritório ao estado dos agentes.
 * @param {{ subscribe?: Function, activeAgents?: any, listeners?: Function[] }} state
 * @returns {() => void}
 */
export function bindOfficeStateTelemetry(state) {
  if (!state || typeof state.subscribe !== "function") return () => {};
  let active = true;
  const listener = (snapshot) => {
    if (active) syncAgentsFromActivity(snapshot?.activeAgents);
  };
  state.subscribe(listener);
  if (state.activeAgents) listener(state);
  return () => {
    active = false;
    if (Array.isArray(state.listeners)) {
      const index = state.listeners.indexOf(listener);
      if (index >= 0) state.listeners.splice(index, 1);
    }
  };
}
