// @ts-check
// Publicação de eventos canônicos de execução de workflow (EP-08.04).
const { createEvent } = require("./event-contract");
const { eventEngine } = require("./event-engine");

const WORKFLOW_PROVIDER = "harness";

function emitWorkflowEvent(fields) {
  try {
    const event = createEvent({
      type: fields.type,
      source: { kind: "native", provider: fields.provider || WORKFLOW_PROVIDER, confidence: "explicit" },
      projectId: fields.projectId,
      executionId: fields.executionId,
      taskId: fields.taskId,
      agentId: fields.agentId,
      payload: fields.payload || {},
    });
    return eventEngine.ingest(event).accepted ? event.id : "";
  } catch {
    return "";
  }
}

module.exports = { WORKFLOW_PROVIDER, emitWorkflowEvent };
