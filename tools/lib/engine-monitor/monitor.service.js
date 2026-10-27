// @ts-check
// Serviço central de monitoramento de presença e atividade de motores (EP-09.06).
const { loadThresholds } = require("./thresholds");
const { createInitialState, stepActivityMachine } = require("./activity-machine");
const { checkOpenCodePresence } = require("./presence-opencode");
const { checkCliPresence } = require("./presence-cli");
const { classifyActivityEvent } = require("./activity-classifier");

/**
 * @typedef {{
 *   id: string,
 *   presenca: "online" | "offline",
 *   porta?: number,
 *   portaFixada?: boolean,
 *   atividade: import("./activity-machine").AtividadeEstado,
 *   desde: string,
 *   detalhe?: string,
 *   evidencia?: {
 *     fonte: string,
 *     observadoEm: string,
 *     referencia?: string
 *   },
 *   sessoes: Array<{ id: string, atividade: import("./activity-machine").AtividadeEstado }>
 * }} MotorStatus
 */

class EngineMonitorService {
  /**
   * @param {{ rootDir?: string, nowFn?: () => number }} [opts]
   */
  constructor(opts = {}) {
    this.rootDir = opts.rootDir || process.cwd();
    this.nowFn = opts.nowFn || (() => Date.now());
    this.config = loadThresholds(this.rootDir).thresholds;

    /** @type {Record<string, import("./activity-machine").EstadoInstancia>} */
    this.engineStates = {
      opencode: createInitialState(this.nowFn()),
      claude: createInitialState(this.nowFn()),
      gemini: createInitialState(this.nowFn()),
      codex: createInitialState(this.nowFn()),
    };

    /** @type {Record<string, { presenca: "online" | "offline", porta?: number, portaFixada?: boolean, detalhe?: string }>} */
    this.presenceStates = {
      opencode: { presenca: "offline" },
      claude: { presenca: "offline" },
      gemini: { presenca: "offline" },
      codex: { presenca: "offline" },
    };

    /** @type {Record<string, { fonte: string, observadoEm: string, referencia?: string }>} */
    this.evidences = {};

    /** @type {Record<string, Record<string, import("./activity-machine").EstadoInstancia>>} */
    this.sessionStates = {
      opencode: {},
      claude: {},
      gemini: {},
      codex: {},
    };

    this.timer = null;
    this.activeObservers = 0;
  }

  /**
   * Registra um evento de telemetria ou stream de um motor.
   * @param {string} engineId
   * @param {any} event
   * @param {string} [sessionId]
   */
  recordEvent(engineId, event, sessionId) {
    if (!this.engineStates[engineId]) return;
    const nowMs = this.nowFn();
    const classified = classifyActivityEvent(event);

    if (classified) {
      this.evidences[engineId] = {
        fonte: event.source || "stream-evento",
        observadoEm: new Date(nowMs).toISOString(),
        referencia: sessionId || event.sessionId || "default",
      };

      const pres = this.presenceStates[engineId]?.presenca || "online";
      this.engineStates[engineId] = stepActivityMachine(this.engineStates[engineId], {
        novoEstado: classified,
        nowMs,
        presenca: pres,
        minDwellMs: this.config.minDwellMs,
        hibernateAfterMs: this.config.hibernateAfterMs,
        inactiveAfterMs: this.config.inactiveAfterMs,
        staleAfterMs: this.config.staleAfterMs,
      });

      if (sessionId) {
        if (!this.sessionStates[engineId][sessionId]) {
          this.sessionStates[engineId][sessionId] = createInitialState(nowMs, "ativo");
        }
        this.sessionStates[engineId][sessionId] = stepActivityMachine(this.sessionStates[engineId][sessionId], {
          novoEstado: classified,
          nowMs,
          presenca: pres,
          minDwellMs: this.config.minDwellMs,
          hibernateAfterMs: this.config.hibernateAfterMs,
          inactiveAfterMs: this.config.inactiveAfterMs,
          staleAfterMs: this.config.staleAfterMs,
        });
      }
    }
  }

  /**
   * Executa uma rodada síncrona de atualização de presença e decaimento temporal.
   */
  async updateCycle() {
    const nowMs = this.nowFn();

    // 1. Atualiza OpenCode
    const ocPres = await checkOpenCodePresence();
    this.presenceStates.opencode = ocPres;

    this.engineStates.opencode = stepActivityMachine(this.engineStates.opencode, {
      nowMs,
      presenca: ocPres.presenca,
      minDwellMs: this.config.minDwellMs,
      hibernateAfterMs: this.config.hibernateAfterMs,
      inactiveAfterMs: this.config.inactiveAfterMs,
      staleAfterMs: this.config.staleAfterMs,
    });

    // 2. Atualiza motores CLI
    for (const cli of ["claude", "gemini", "codex"]) {
      const lastSessionTime = this.engineStates[cli].ultimaAtividadeMs;
      const pres = checkCliPresence(cli, lastSessionTime, {
        nowMs,
        inactiveAfterMs: this.config.inactiveAfterMs,
      });
      this.presenceStates[cli] = pres;

      this.engineStates[cli] = stepActivityMachine(this.engineStates[cli], {
        nowMs,
        presenca: pres.presenca,
        minDwellMs: this.config.minDwellMs,
        hibernateAfterMs: this.config.hibernateAfterMs,
        inactiveAfterMs: this.config.inactiveAfterMs,
        staleAfterMs: this.config.staleAfterMs,
      });
    }
  }

  /**
   * Devolve o instantâneo completo no formato do contrato REST.
   * @returns {Promise<{ geradoEm: string, motores: MotorStatus[] }>}
   */
  async getStatus() {
    await this.updateCycle();
    const nowMs = this.nowFn();

    const motores = Object.keys(this.engineStates).map((id) => {
      const state = this.engineStates[id];
      const pres = this.presenceStates[id] || { presenca: "offline" };
      const sessList = Object.entries(this.sessionStates[id] || {}).map(([sId, sState]) => ({
        id: sId,
        atividade: sState.estado,
      }));

      return {
        id,
        presenca: pres.presenca,
        porta: pres.porta,
        portaFixada: pres.portaFixada,
        atividade: state.estado,
        desde: state.desde,
        detalhe: pres.detalhe || state.detalhe,
        evidencia: this.evidences[id],
        sessoes: sessList,
      };
    });

    return {
      geradoEm: new Date(nowMs).toISOString(),
      motores,
    };
  }
}

let defaultMonitor = null;

function getEngineMonitor(rootDir) {
  if (!defaultMonitor) {
    defaultMonitor = new EngineMonitorService({ rootDir });
  }
  return defaultMonitor;
}

module.exports = {
  EngineMonitorService,
  getEngineMonitor,
};
