// @ts-check
// Fachada de network: reexporta a API pública dos módulos (network-access, network-auth, network-session, network-summary, network-proxy).
const { getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, isProxiedRequest, clientKey, extractRequestPin, isAllowedHost } = require("./network-access");
const { safeEqual, checkPinAttempt, authorizeRemote, validatePin } = require("./network-auth");
const { issueSessionToken, buildSessionCookie } = require("./network-session");
const { getRemoteSummary, printRemoteBanner } = require("./network-summary");
const { proxyAppRequest, setupWebSocketHmrProxy } = require("./network-proxy");

module.exports = {
  getNetworkInterfaces, getPrimaryLocalIp, isLocalhostRequest, isProxiedRequest, clientKey, extractRequestPin, isAllowedHost,
  safeEqual, checkPinAttempt, authorizeRemote, validatePin, issueSessionToken, buildSessionCookie,
  getRemoteSummary, printRemoteBanner, proxyAppRequest, setupWebSocketHmrProxy,
};
