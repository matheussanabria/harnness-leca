// @ts-check
// Compatibilidade temporária com o formato plano de /api/orchestration/capabilities.
// Os booleanos são derivados do catálogo canônico; nenhum valor é declarado em paralelo.

/** @param {Record<string, any>} providers */
function legacyCapabilities(providers) {
  const stateOf = (providerId, operationId) => providers[providerId]?.operations?.[operationId]?.state;
  const isOn = (providerId, operationId) => stateOf(providerId, operationId) === "available";

  /** @param {string} providerId */
  const engine = (providerId) => ({
    provider: providerId,
    label: providers[providerId].label,
    streamSupported: isOn(providerId, "execution.stream"),
    cancelSupported: isOn(providerId, "execution.cancel"),
    cancelScope: providers[providerId].operations["execution.cancel"].scope,
    permissionsSupported: isOn(providerId, "execution.approval"),
    pauseSupported: isOn(providerId, "execution.pause"),
    externalProcessControl: false,
  });

  return {
    claude: engine("claude"),
    gemini: engine("gemini"),
    opencode: engine("opencode"),
    codex: engine("codex"),
    ollama: engine("ollama"),
    proc_manager: {
      provider: "proc_manager",
      label: providers.proc_manager.label,
      startSupported: isOn("proc_manager", "service.start"),
      stopSupported: isOn("proc_manager", "service.stop"),
      streamLogsSupported: isOn("proc_manager", "service.logs"),
      killTreeSupported: isOn("proc_manager", "service.killTree"),
    },
    routines: {
      provider: "routines",
      label: providers.routines.label,
      triggerImmediateSupported: isOn("routines", "routine.trigger"),
      listSupported: isOn("routines", "routine.list"),
    },
  };
}

module.exports = { legacyCapabilities };
