// @ts-check
const { PORT, PIN, IS_REMOTE, send, readJsonBody, getActiveAppUrl } = require("../config");
const netLib = require("../../../tools/lib/network");

// PIN e QR (que carrega o PIN) só saem para o próprio computador, sem proxy ou túnel: quem já está autenticado
// pelo celular não precisa deles, e quem não está não pode lê-los.
function apiRemoteInfo({ req, res }) {
  const base = { isRemote: IS_REMOTE, port: PORT, appUrl: getActiveAppUrl() };
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 200, { ...base, pin: null, urls: [], qrTarget: null, svgQr: null, primaryIp: null });
  }
  const summary = netLib.getRemoteSummary(PORT, PIN);
  return send(res, 200, {
    ...base,
    pin: PIN,
    urls: summary.urls,
    qrTarget: summary.qrTarget,
    svgQr: summary.svgQr,
    primaryIp: netLib.getPrimaryLocalIp(),
  });
}

async function apiRemotePin({ req, res }) {
  if (netLib.isLocalhostRequest(req)) return send(res, 200, { ok: true });
  if (!PIN) return send(res, 403, { error: "Acesso remoto não está habilitado. Inicie o Harness com --remote." });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  const result = netLib.checkPinAttempt(req, String((body && body.pin) || "").trim(), PIN);
  if (result.reason === "locked") {
    res.setHeader("Retry-After", String(result.retryAfterSec || 900));
    return send(res, 429, { error: "Muitas tentativas de PIN. Tente de novo mais tarde.", retryAfterSec: result.retryAfterSec });
  }
  if (!result.ok) return send(res, 401, { error: "PIN incorreto. Verifique o terminal do computador." });
  res.setHeader("Set-Cookie", netLib.buildSessionCookie(req, netLib.issueSessionToken(PIN)));
  return send(res, 200, { ok: true });
}

module.exports = {
  apiRemoteInfo,
  apiRemotePin,
};
