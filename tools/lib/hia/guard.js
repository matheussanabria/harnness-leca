// @ts-check
// Resource Governor & Execution Guard (Fase F6 - HIA-011)
// Controla concorrência da inferência local em CPU (maxConcurrency = 1)
// e detecta loops repetitivos de chamadas de ferramentas.

const crypto = require("crypto");

/**
 * Fila com limite estrito de concorrência para execução de tarefas locais em CPU
 */
class ExecutionQueue {
  /**
   * @param {number} [maxConcurrency=1]
   */
  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
    this.activeCount = 0;
    /** @type {Array<() => void>} */
    this.waiting = [];
  }

  /**
   * Executa uma tarefa respeitando a concorrência máxima permitida
   * @template T
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  async run(task) {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise((resolve) => this.waiting.push(resolve));
    }

    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      if (this.waiting.length > 0) {
        const next = this.waiting.shift();
        if (next) next();
      }
    }
  }

  getPendingCount() {
    return this.waiting.length;
  }

  getActiveCount() {
    return this.activeCount;
  }
}

/**
 * Rastreador de padrões repetitivos para evitar loops de agentes ou reexecução desnecessária
 */
class LoopGuard {
  /**
   * @param {number} [threshold=3]
   */
  constructor(threshold = 3) {
    this.threshold = threshold;
    /** @type {string[]} */
    this.history = [];
  }

  /**
   * Computa hash da ação
   * @param {string} tool
   * @param {any} input
   */
  hashAction(tool, input) {
    const raw = `${tool}:${JSON.stringify(input || {})}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  /**
   * Registra a tentativa e verifica se ultrapassou o teto de repetição
   * @param {string} tool
   * @param {any} input
   * @returns {{ isLoop: boolean, occurrences: number }}
   */
  check(tool, input) {
    const h = this.hashAction(tool, input);
    this.history.push(h);
    if (this.history.length > 20) this.history.shift();

    const occurrences = this.history.filter((x) => x === h).length;
    return {
      isLoop: occurrences >= this.threshold,
      occurrences,
    };
  }

  reset() {
    this.history = [];
  }
}

const localInferenceQueue = new ExecutionQueue(1);

module.exports = {
  ExecutionQueue,
  LoopGuard,
  localInferenceQueue,
};
