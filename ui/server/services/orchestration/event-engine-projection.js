// @ts-check
// Projeção de eventos no estado em memória e consultas (mixin de EventEngine).

const eventEngineProjection = {
  /**
   * Projeta os eventos no estado atual mantido em memória
   * @private
   * @param {import('./event-contract').HarnessEvent} event
   */
  projectEvent(event) {
    const payload = event.payload || {};

    // 1. Projeção de Agentes
    if (event.agentId || event.type.startsWith("agent.")) {
      const agentId = event.agentId || payload.agentId || event.source.provider;
      const current = this.agentsState.get(agentId) || {
        id: agentId,
        name: payload.name || agentId,
        role: payload.role || "Agente",
        provider: event.source.provider,
        activeExecutions: 0
      };

      if (event.type === "agent.status_changed" || event.type === "agent.detected") {
        current.status = payload.status || current.status;
        current.confidence = event.source.confidence;
        current.lastObservedAt = event.timestamp;
        if (payload.currentTask !== undefined) {
          current.currentTask = payload.currentTask;
        }
      }

      this.agentsState.set(agentId, current);
    }

    // 2. Projeção de Execuções e Tarefas
    if (event.executionId) {
      const execId = event.executionId;
      const currentExec = this.executionsState.get(execId) || {
        id: execId,
        projectId: event.projectId,
        agentId: event.agentId || event.source?.provider,
        provider: event.source?.provider || event.agentId || "desconhecido",
        title: payload.title || `Execução ${(event.source?.provider || 'agente').toUpperCase()} (${execId.slice(0, 8)})`,
        parentExecutionId: event.parentExecutionId,
        status: "running",
        startedAt: event.timestamp,
        updatedAt: event.timestamp,
        tasks: [],
        tools: [],
        artifacts: [],
        error: null,
        confidence: event.source.confidence
      };

      if (payload.title && (!currentExec.title || currentExec.title.startsWith("Execução "))) {
        currentExec.title = payload.title;
      }
      if (!currentExec.provider && event.source?.provider) {
        currentExec.provider = event.source.provider;
      }

      currentExec.updatedAt = event.timestamp;
      currentExec.confidence = event.source.confidence;

      if (event.type === "execution.started") {
        currentExec.status = "running";
        currentExec.startedAt = event.timestamp;
      } else if (event.type === "execution.completed") {
        currentExec.status = "completed";
        currentExec.completedAt = event.timestamp;
      } else if (event.type === "execution.failed") {
        currentExec.status = "failed";
        currentExec.completedAt = event.timestamp;
        currentExec.error = payload.error || "Execução com falha";
      } else if (event.type === "execution.cancelled") {
        currentExec.status = "cancelled";
        currentExec.completedAt = event.timestamp;
      }

      // Tarefas na execução
      if (event.taskId) {
        let task = currentExec.tasks.find((/** @type {{ id: string; }} */ t) => t.id === event.taskId);
        if (!task) {
          task = { id: event.taskId, title: payload.title || event.taskId, status: "created", startedAt: event.timestamp };
          currentExec.tasks.push(task);
        }
        if (event.type === "task.started") task.status = "running";
        else if (event.type === "task.completed") task.status = "completed";
        else if (event.type === "task.failed") { task.status = "failed"; task.error = payload.error; }
        else if (event.type === "task.blocked") task.status = "blocked";
      }

      // Ferramentas na execução
      if (event.type.startsWith("tool.")) {
        currentExec.tools.push({
          name: payload.toolName || payload.name,
          status: event.type === "tool.completed" ? "success" : event.type === "tool.failed" ? "error" : "running",
          timestamp: event.timestamp,
          hint: payload.hint,
          error: payload.error
        });
      }

      // Artefatos criados
      if (event.type === "artifact.created" && payload.path) {
        currentExec.artifacts.push({
          path: payload.path,
          type: payload.type || "file",
          timestamp: event.timestamp
        });
      }

      this.executionsState.set(execId, currentExec);

      // Recalcula contagem de execuções ativas do agente
      if (currentExec.agentId && this.agentsState.has(currentExec.agentId)) {
        const ag = this.agentsState.get(currentExec.agentId);
        let active = 0;
        for (const ex of this.executionsState.values()) {
          if (ex.agentId === currentExec.agentId && ex.status === "running") active++;
        }
        ag.activeExecutions = active;
        if (active > 0) ag.status = "running";
        else if (ag.status === "running") ag.status = "idle";
      }
    }

    // 3. Projeção de Integrações
    if (event.type === "integration.status_changed") {
      const provider = event.source.provider;
      this.integrationsState.set(provider, {
        provider,
        status: payload.status || "connected",
        available: !!payload.available,
        lastCheckedAt: event.timestamp,
        error: payload.error || null
      });
    }
  },

  /**
   * Consulta histórico de eventos com filtros
   * @param {Object} [filter]
   * @param {string} [filter.projectId]
   * @param {string} [filter.executionId]
   * @param {string} [filter.agentId]
   * @param {string} [filter.type]
   * @param {number} [filter.limit=50]
   * @param {string} [filter.since]
   * @returns {import('./event-contract').HarnessEvent[]}
   */
  getEvents(filter = {}) {
    let result = [...this.history];

    if (filter.projectId) {
      result = result.filter(e => e.projectId === filter.projectId);
    }
    if (filter.executionId) {
      result = result.filter(e => e.executionId === filter.executionId);
    }
    if (filter.agentId) {
      result = result.filter(e => e.agentId === filter.agentId || e.source.provider === filter.agentId);
    }
    if (filter.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      if (!isNaN(sinceTime)) {
        result = result.filter(e => new Date(e.timestamp).getTime() > sinceTime);
      }
    }

    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    return result.slice(-limit);
  },

  /**
   * Retorna o estado consolidado para um projeto ou geral
   * @param {string} [projectId]
   */
  getState(projectId) {
    const agents = Array.from(this.agentsState.values());
    let executions = Array.from(this.executionsState.values());
    if (projectId) {
      executions = executions.filter(ex => !ex.projectId || ex.projectId === projectId);
    }

    const integrations = Array.from(this.integrationsState.values());

    return {
      timestamp: new Date().toISOString(),
      projectId: projectId || null,
      summary: {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === "running" || a.status === "active").length,
        runningExecutions: executions.filter(e => e.status === "running").length,
        completedExecutions: executions.filter(e => e.status === "completed").length,
        failedExecutions: executions.filter(e => e.status === "failed").length
      },
      agents,
      executions: executions.slice(-30),
      integrations
    };
  },

  /**
   * Reseta todo o estado (usado em testes unitários)
   */
  reset() {
    this.history = [];
    this.seenEventIds.clear();
    this.seenSourceKeys.clear();
    this.agentsState.clear();
    this.executionsState.clear();
    this.integrationsState.clear();
    this.initDefaultState();
  },
};

module.exports = { eventEngineProjection };
