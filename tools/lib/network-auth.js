// @ts-check
// Autorização do acesso remoto: local direto, sessão assinada ou PIN com limite de tentativas.
const crypto = require("crypto");
const { isLocalhostRequest, clientKey, extractRequestPin } = require("./network-access");
const { defaultThrottle } = require("./network-throttle");
const session = require("./network-session");

/**
 * @typedef {{ ok: boolean, reason: "local"|"no-pin"|"session"|"pin"|"locked"|"denied"|"unprotected-proxy", retryAfterSec?: number }} AuthResult
 */

/** Comparação em tempo constante, independente do tamanho dos textos. */
function safeEqual(a, b) {
  const da = crypto.createHash("sha256").update(String(a)).digest();
  const db = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}

/**
 * Confere um PIN apresentado, contando a falha no limitador.
 * @param {import("http").IncomingMessage} req
 * @param {string} candidate
 * @param {string} configuredPin
 * @param {ReturnType<typeof import("./network-throttle").createThrottle>} [throttle]
 * @returns {AuthResult}
 */
function checkPinAttempt(req, candidate, configuredPin, throttle = defaultThrottle) {
  const key = clientKey(req);
  const wait = throttle.retryAfterSec(key);
  if (wait > 0) return { ok: false, reason: "locked", retryAfterSec: wait };
  if (candidate && safeEqual(candidate, configuredPin)) {
    throttle.recordSuccess(key);
    return { ok: true, reason: "pin" };
  }
  throttle.recordFailure(key);
  const after = throttle.retryAfterSec(key);
  return after > 0 ? { ok: false, reason: "locked", retryAfterSec: after } : { ok: false, reason: "denied" };
}

/**
 * Decide se a requisição pode seguir. Loopback direto passa; o resto exige sessão ou PIN.
 * Sem PIN configurado, só o tráfego local direto é aceito: por proxy ou túnel não há quem autentique.
 * @param {import("http").IncomingMessage} req
 * @param {string} configuredPin
 * @param {URL} [url]
 * @param {ReturnType<typeof import("./network-throttle").createThrottle>} [throttle]
 * @returns {AuthResult}
 */
function authorizeRemote(req, configuredPin, url, throttle = defaultThrottle) {
  if (isLocalhostRequest(req)) return { ok: true, reason: "local" };
  // Sem PIN só o loopback direto (já aceito acima) entra. Um túnel que não acrescenta cabeçalhos (ssh -R, frp, socat)
  // não é detectável como proxy, então tudo que não for local direto é recusado.
  if (!configuredPin) return { ok: false, reason: "unprotected-proxy" };
  if (session.verifySessionToken(session.readSessionCookie(req), configuredPin)) return { ok: true, reason: "session" };
  const sent = extractRequestPin(req, url);
  if (!sent) return { ok: false, reason: "denied" };
  return checkPinAttempt(req, sent, configuredPin, throttle);
}

/** Versão booleana, compatível com quem só quer saber se pode seguir. */
function validatePin(req, configuredPin, url) {
  return authorizeRemote(req, configuredPin, url).ok;
}

module.exports = { safeEqual, checkPinAttempt, authorizeRemote, validatePin };
