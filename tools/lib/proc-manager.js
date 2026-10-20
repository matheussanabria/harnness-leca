// @ts-check
// Fachada de proc-manager: reexporta a API pública dos módulos (proc-manager-core, proc-manager-config, proc-manager-services, proc-manager-run).
const { killTree } = require("./proc-manager-core");
const { extractCommandsFromDocs, extractAppConfigFromDocs } = require("./proc-manager-config");
const { listProjectServices, saveProjectAppConfig } = require("./proc-manager-services");
const { startService, stopService, getServiceLogs, subscribeLogs } = require("./proc-manager-run");

module.exports = { listProjectServices, saveProjectAppConfig, startService, stopService, getServiceLogs, subscribeLogs, extractCommandsFromDocs, extractAppConfigFromDocs, killTree };
