// @ts-check
const { PORT, PIN, IS_REMOTE, send, readJsonBody, getActiveAppUrl } = require("../config");
const netLib = require("../../../tools/lib/network");

function apiRemoteInfo({ res }) {
  const summary = netLib.getRemoteSummary(PORT, PIN);
  return send(res, 200, {
    isRemote: IS_REMOTE,
    port: PORT,
    pin: PIN,
    urls: summary.urls,
    qrTarget: summary.qrTarget,
    svgQr: summary.svgQr,
    primaryIp: netLib.getPrimaryLocalIp(),
    appUrl: getActiveAppUrl(),
  });
}

async function apiRemotePin({ req, res }) {
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  const pin = String((body && body.pin) || "").trim();
  if (PIN && pin !== PIN) {
    return send(res, 401, { error: "PIN incorreto. Verifique o terminal do computador." });
  }
  res.setHeader("Set-Cookie", `harness_pin=${encodeURIComponent(PIN)}; Path=/; SameSite=Lax; Max-Age=2592000`);
  return send(res, 200, { ok: true });
}

module.exports = {
  apiRemoteInfo,
  apiRemotePin,
};
