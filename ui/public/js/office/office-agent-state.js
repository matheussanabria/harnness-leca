// @ts-check
/**
 * Gerenciador Canônico do Estado Real dos Agentes na Cena (EP-03.05)
 * Responsabilidade Única: Manter o estado operacional de cada agente de IA
 * sincronizado com as execuções de chat, jobs de background e telemetria.
 */

/**
 * @typedef {'idle' | 'thinking' | 'streaming' | 'waiting_approval' | 'error' | 'offline'} AgentExecutionStatus
 *
 * @typedef {Object} AgentRuntimeState
 * @property {string} agentKey - Identificador do agente (claude, gemini, opencode, codex)
 * @property {AgentExecutionStatus} status - Estado operacional atual
 * @property {number} activeCount - Quantidade de conversas ou jobs ativos
 * @property {string} currentTask - Descrição da tarefa atual, se houver
 * @property {number} lastUpdated - Timestamp da última atualização
 */

export const AGENT_KEYS = Object.freeze(["claude", "gemini", "opencode", "codex"]);

/**
 * Temas visuais e configurações de cada estado operacional
 * @type {Record<AgentExecutionStatus, { label: string, color: string, icon: string, isTyping: boolean }>}
 */
export const STATUS_THEMES = Object.freeze({
  idle: {
    label: "Em espera",
    color: "#64748b",
    icon: "fa-solid fa-pause",
    isTyping: false
  },
  thinking: {
    label: "Pensando",
    color: "#38bdf8",
    icon: "fa-solid fa-brain",
    isTyping: false
  },
  streaming: {
    label: "Executando",
    color: "#10b981",
    icon: "fa-solid fa-keyboard",
    isTyping: true
  },
  waiting_approval: {
    label: "Aprovação",
    color: "#f59e0b",
    icon: "fa-solid fa-hand",
    isTyping: false
  },
  error: {
    label: "Erro",
    color: "#ef4444",
    icon: "fa-solid fa-triangle-exclamation",
    isTyping: false
  },
  offline: {
    label: "Offline",
    color: "#334155",
    icon: "fa-solid fa-power-off",
    isTyping: false
  }
});

/**
 * Cores temáticas de cada agente
 * @type {Record<string, string>}
 */
export const AGENT_THEME_COLORS = Object.freeze({
  claude: "#d97757",
  gemini: "#5c87f2",
  opencode: "#10b981",
  codex: "#a855f7"
});

export class OfficeAgentStateManager {
  constructor() {
    /** @type {Map<string, AgentRuntimeState>} */
    this._states = new Map();
    /** @type {Set<(states: Record<string, AgentRuntimeState>) => void>} */
    this._listeners = new Set();

    this.reset();
  }

  /**
   * Reseta os estados de fábrica de todos os agentes
   */
  reset() {
    this._states.clear();
    const now = Date.now();
    for (const key of AGENT_KEYS) {
      this._states.set(key, {
        agentKey: key,
        status: "idle",
        activeCount: 0,
        currentTask: "",
        lastUpdated: now
      });
    }
    this._notify();
  }

  /**
   * Retorna o estado atual de um agente
   * @param {string} agentKey
   * @returns {AgentRuntimeState}
   */
  getAgentState(agentKey) {
    const state = this._states.get(agentKey);
    if (!state) {
      return {
        agentKey,
        status: "offline",
        activeCount: 0,
        currentTask: "",
        lastUpdated: Date.now()
      };
    }
    return { ...state };
  }

  /**
   * Atualiza o estado operacional de um agente
   * @param {string} agentKey
   * @param {Partial<AgentRuntimeState>} updates
   * @returns {AgentRuntimeState} Estado consolidado
   */
  setAgentState(agentKey, updates = {}) {
    const existing = this.getAgentState(agentKey);
    const validStatus = STATUS_THEMES[updates.status] ? updates.status : existing.status;

    const merged = {
      ...existing,
      ...updates,
      agentKey,
      status: validStatus,
      lastUpdated: Date.now()
    };

    this._states.set(agentKey, merged);
    this._notify();
    return merged;
  }

  /**
   * Retorna um mapa simples com todos os estados
   * @returns {Record<string, AgentRuntimeState>}
   */
  getAllStates() {
    const result = {};
    for (const [k, v] of this._states) {
      result[k] = { ...v };
    }
    return result;
  }

  /**
   * Sincroniza estado a partir da telemetria de chat e orquestração
   * @param {string} agentKey
   * @param {{ status?: string, streaming?: boolean, currentTask?: string }} telemetry
   */
  syncFromExecution(agentKey, telemetry = {}) {
    let status = "idle";
    if (telemetry.streaming) {
      status = "streaming";
    } else if (telemetry.status === "thinking") {
      status = "thinking";
    } else if (telemetry.status === "waiting_approval") {
      status = "waiting_approval";
    } else if (telemetry.status === "error") {
      status = "error";
    } else if (telemetry.status === "offline") {
      status = "offline";
    }

    return this.setAgentState(agentKey, {
      status,
      activeCount: telemetry.streaming || status !== "idle" ? 1 : 0,
      currentTask: telemetry.currentTask || ""
    });
  }

  /**
   * Registra ouvinte para alterações no estado dos agentes
   * @param {(states: Record<string, AgentRuntimeState>) => void} listener
   * @returns {() => void} Função de desinscrição
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * @private
   */
  _notify() {
    const snapshot = this.getAllStates();
    for (const listener of this._listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("[OfficeAgentState] Erro ao notificar ouvinte:", err);
      }
    }
  }
}

export const officeAgentState = new OfficeAgentStateManager();
