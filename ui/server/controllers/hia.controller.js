// @ts-check
// Controller para métricas e telemetria da camada Harness Intelligence & Automation (Fase F7 - HIA-012)
const { send } = require("../config");
const { getTelemetryMetrics } = require("../../../tools/lib/hia/telemetry");
const { getHardwareSnapshot } = require("../../../tools/lib/hia/hardware-profiler");
const { listTools } = require("../../../tools/lib/hia/registry");
const { listModels } = require("../../../tools/lib/hia/model-registry");
const { getRuntimeTelemetryMetrics } = require("../../../tools/lib/runtime/telemetry");

async function apiHiaMetrics({ res }) {
  const telemetry = getTelemetryMetrics();
  const hardware = getHardwareSnapshot();
  const tools = listTools();
  const models = listModels();
  const localRuntime = getRuntimeTelemetryMetrics();

  return send(res, 200, {
    telemetry,
    hardware,
    localRuntime,
    registeredToolsCount: tools.length,
    registeredModelsCount: models.length,
    routingEnabled: process.env.HIA_ROUTING_ENABLED !== "false",
    contextScope: process.env.HIA_CONTEXT_SCOPE || "full",
  });
}

module.exports = {
  apiHiaMetrics,
};
