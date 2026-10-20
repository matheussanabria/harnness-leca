// @ts-check
// Adaptador de Processos de Desenvolvimento Locais (proc-manager) para o Event Engine M2
const procManager = require("../../../../../tools/lib/proc-manager");
const { createEvent } = require("../event-contract");

/**
 * Converte o estado atual dos processos locais gerenciados em eventos canônicos
 * @param {string} [slug]
 * @returns {import('../event-contract').HarnessEvent[]}
 */
function collectServicesEvents(slug) {
  const events = [];
  if (!slug) return events;

  let services = [];
  try {
    services = procManager.listProjectServices(slug);
  } catch {
    return events;
  }

  for (const s of services) {
    const serviceId = s.id || "svc";
    let eventType = "execution.progressed";
    if (s.status === "running") eventType = "execution.started";
    else if (s.status === "stopped") eventType = "execution.completed";
    else if (s.status === "failed") eventType = "execution.failed";

    events.push(createEvent({
      id: `service-${slug}-${serviceId}-${s.startedAt || Date.now()}`,
      type: eventType,
      source: {
        kind: "process_manager",
        provider: "proc_manager",
        sourceEventId: `proc-${slug}-${serviceId}`,
        confidence: "explicit"
      },
      projectId: slug,
      executionId: `service-${slug}-${serviceId}`,
      taskId: `task-${slug}-${serviceId}`,
      timestamp: s.startedAt ? new Date(s.startedAt).toISOString() : new Date().toISOString(),
      payload: {
        title: s.name || `Serviço ${serviceId.toUpperCase()}`,
        serviceId: serviceId,
        name: s.name,
        command: s.command,
        status: s.status,
        pid: s.pid,
        url: s.url,
        exitCode: s.exitCode
      }
    }));
  }

  return events;
}

module.exports = {
  collectServicesEvents
};
