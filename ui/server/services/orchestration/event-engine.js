// @ts-check
// Event Engine do Centro de Orquestração M2 (Harness Leca)
const { EventEmitter } = require("node:events");
const { validateEvent } = require("./event-contract");
const { eventEngineProjection } = require("./event-engine-projection");

class EventEngine extends EventEmitter {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxHistory=1000]
   */
  constructor(opts = {}) {
    super();
    this.maxHistory = opts.maxHistory || 1000;
    /** @type {import('./event-contract').HarnessEvent[]} */
    this.history = [];
    /** @type {Set<string>} */
    this.seenEventIds = new Set();
    /** @type {Map<string, string>} */
    this.seenSourceKeys = new Map(); // provider:sourceEventId -> id

    // Projeções de estado em memória
    /** @type {Map<string, any>} */
    this.agentsState = new Map();
    /** @type {Map<string, any>} */
    this.executionsState = new Map();
    /** @type {Map<string, any>} */
    this.integrationsState = new Map();

    this.initDefaultState();
  }

  initDefaultState() {
    const defaultEngines = [
      { id: "claude", name: "Claude Code", role: "Orquestrador & Engenharia", provider: "anthropic" },
      { id: "gemini", name: "Gemini (Antigravity)", role: "Fullstack & Modelagem 3D", provider: "google" },
      { id: "opencode", name: "OpenCode", role: "Offline QA & Hacker Lab", provider: "opencode" }
    ];

    for (const eng of defaultEngines) {
      this.agentsState.set(eng.id, {
        id: eng.id,
        name: eng.name,
        role: eng.role,
        provider: eng.provider,
        status: "unknown",
        confidence: "unknown",
        lastObservedAt: null,
        activeExecutions: 0,
        currentTask: "Sem telemetria recente"
      });

      this.integrationsState.set(eng.id, {
        provider: eng.id,
        status: "unknown",
        available: false,
        lastCheckedAt: null,
        error: null
      });
    }
  }

  /**
   * Ingestão canônica de eventos com validação, deduplicação e projeção de estado
   * @param {import('./event-contract').HarnessEvent} event
   * @returns {{ accepted: boolean, duplicate?: boolean, error?: string }}
   */
  ingest(event) {
    const validation = validateEvent(event);
    if (!validation.valid) {
      return { accepted: false, error: validation.errors.join("; ") };
    }

    // Deduplicação por ID canônico
    if (this.seenEventIds.has(event.id)) {
      return { accepted: false, duplicate: true };
    }

    // Deduplicação por chave de origem (quando fornecida)
    if (event.source?.sourceEventId) {
      const sourceKey = `${event.source.provider}:${event.source.sourceEventId}`;
      if (this.seenSourceKeys.has(sourceKey)) {
        return { accepted: false, duplicate: true };
      }
      this.seenSourceKeys.set(sourceKey, event.id);
    }

    this.seenEventIds.add(event.id);
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      const removed = this.history.shift();
      if (removed) {
        this.seenEventIds.delete(removed.id);
        if (removed.source?.sourceEventId) {
          this.seenSourceKeys.delete(`${removed.source.provider}:${removed.source.sourceEventId}`);
        }
      }
    }

    // Projeta o estado consolidado
    this.projectEvent(event);

    // Notifica listeners locais e streams SSE
    this.emit("event", event);
    return { accepted: true };
  }
}

Object.assign(EventEngine.prototype, eventEngineProjection);

// Instância singleton para uso em todo o servidor
const defaultEventEngine = new EventEngine();

module.exports = {
  EventEngine,
  eventEngine: defaultEventEngine
};
