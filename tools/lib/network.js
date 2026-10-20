// @ts-check
// Fachada de network: reexporta a API pública dos módulos (network-access, network-summary, network-proxy).
const { getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, extractRequestPin, validatePin, isAllowedHost } = require("./network-access");
const { getRemoteSummary, printRemoteBanner } = require("./network-summary");
const { proxyAppRequest, setupWebSocketHmrProxy } = require("./network-proxy");

module.exports = { getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, extractRequestPin, validatePin, isAllowedHost, getRemoteSummary, printRemoteBanner, proxyAppRequest, setupWebSocketHmrProxy };
