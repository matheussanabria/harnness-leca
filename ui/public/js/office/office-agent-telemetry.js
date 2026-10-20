// @ts-check
// Ponte de telemetria entre execuções reais e o estado canônico dos agentes (EP-03.05).
import { AGENT_KEYS, STATUS_THEMES, officeAgentState } from "./office-agent-state.js";
import { subscribeAllChatExecutions } from "../modules/chat-execution-store.js";

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
 * Liga as execuções de chat ao estado dos agentes.
 * @returns {() => void}
 */
export function bindChatExecutionTelemetry() {
  return subscribeAllChatExecutions((snapshot) => {
    const engine = snapshot && snapshot.currentEngine;
    if (!engine) return;
    syncAgentFromChatExecution(engine, snapshot);
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
