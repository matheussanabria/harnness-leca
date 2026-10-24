// @ts-check
// Publicação de eventos canônicos de execução de workflow (EP-08.04).
const { createEvent } = require("./event-contract");
const { eventEngine } = require("./event-engine");
const { bridgeWorkflowEvent } = require("./workflow-event-bridge");

const WORKFLOW_PROVIDER = "harness";

function emitWorkflowEvent(fields) {
  try {
    const event = createEvent({
      type: fields.type,
      source: { kind: "native", provider: fields.provider || WORKFLOW_PROVIDER, confidence: fields.confidence || "explicit" },
      projectId: fields.projectId,
      executionId: fields.executionId,
      taskId: fields.taskId,
      agentId: fields.agentId,
      parentExecutionId: fields.parentExecutionId,
      correlationId: fields.correlationId,
      payload: fields.payload || {},
    });
    const accepted = eventEngine.ingest(event).accepted;
    bridgeWorkflowEvent(event); // persistencia EP-09 (T2.1); nunca lanca
    return accepted ? event.id : "";
  } catch {
    return "";
  }
}

module.exports = { WORKFLOW_PROVIDER, emitWorkflowEvent };
