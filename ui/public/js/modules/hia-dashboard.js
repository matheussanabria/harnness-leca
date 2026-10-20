// @ts-check
/**
 * HIA Dashboard Module (HIA-012)
 * Constrói o painel de métricas HIA com fontes em memória e telemetria persisitida.
 * Interface para ser consumida pelo frontend do Harness (FontAwesome, zero emojis).
 */
const { getTelemetryMetrics } = require("../../../../tools/lib/hia/telemetry");
const { getHardwareSnapshot } = require("../../../../tools/lib/hia/hardware-profiler");
const { listTools } = require("../../../../tools/lib/hia/registry");
const { listModels } = require("../../../../tools/lib/hia/model-registry");

/**
 * Gera o payload completo para o dashboard de métricas HIA
 * @returns {{
 *   telemetry: object,
 *   hardware: object,
 *   registry: { toolsCount: number, localModels: number, cloudModels: number },
 *   config: { routingEnabled: boolean, contextScope: string }
 * }}
 */
function buildDashboardPayload() {
  const telemetry = getTelemetryMetrics();
  const hardware = getHardwareSnapshot();
  const tools = listTools();
  const models = listModels();

  const localModels = models.filter((m) => m.tier === "local_llm").length;
  const cloudModels = models.filter((m) => m.tier !== "local_llm").length;

  return {
    telemetry: {
      totalExecutions: telemetry.totalExecutions,
      totalTokensSaved: telemetry.totalTokensSaved,
      estimatedCostAvoided: Math.round((telemetry.totalTokensSaved / 1000) * 0.003 * 100) / 100,
      byExecutorType: telemetry.byExecutorType,
    },
    hardware: {
      cpu: hardware.cpu.model,
      recommendedThreads: hardware.cpu.recommendedThreads,
      totalRamMb: hardware.memory.totalMb,
      freeRamMb: hardware.memory.freeMb,
      viable: hardware.viable,
      alert: hardware.alert || null,
    },
    registry: {
      toolsCount: tools.length,
      localModels,
      cloudModels,
    },
    config: {
      routingEnabled: process.env.HIA_ROUTING_ENABLED !== "false",
      contextScope: process.env.HIA_CONTEXT_SCOPE || "full",
    },
  };
}

module.exports = {
  buildDashboardPayload,
};
