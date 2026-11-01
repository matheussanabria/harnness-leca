// @ts-check
// Sessão do acesso remoto: token assinado em cookie HttpOnly no lugar do PIN em texto puro.
// A chave nasce a cada início do processo e nunca sai dele; o PIN entra na assinatura, então trocar o PIN invalida
// as sessões e o token não permite descobrir o PIN offline.
const crypto = require("crypto");

const SESSION_COOKIE = "harness_session";
const TTL_SEC = 7 * 24 * 3600;
const KEY = crypto.randomBytes(32);

/** @param {number} exp @param {string} pin */
function sign(exp, pin) {
  return crypto.createHmac("sha256", KEY).update(`s1|${exp}|${pin}`).digest("hex");
}

/** @param {string} pin @param {number} [nowMs] */
function issueSessionToken(pin, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + TTL_SEC;
  return `${exp}.${sign(exp, pin)}`;
}

/** @param {unknown} token @param {string} pin @param {number} [nowMs] */
function verifySessionToken(token, pin, nowMs = Date.now()) {
  if (typeof token !== "string") return false;
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp <= Math.floor(nowMs / 1000)) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2], "hex"), Buffer.from(sign(exp, pin), "hex"));
}

/** @param {import("http").IncomingMessage} req @returns {string} */
function readSessionCookie(req) {
  const header = (req.headers && req.headers.cookie) || "";
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(header);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return "";
  }
}

/** HTTPS direto ou anunciado pelo proxy; só decide o atributo Secure, nunca autoriza nada. */
function isSecureRequest(req) {
  const h = (req && req.headers) || {};
  if (/** @type {any} */ (req.socket) && /** @type {any} */ (req.socket).encrypted) return true;
  const proto = String(h["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (proto === "https") return true;
  return /"scheme"\s*:\s*"https"/i.test(String(h["cf-visitor"] || ""));
}

/** @param {import("http").IncomingMessage} req @param {string} token */
function buildSessionCookie(req, token) {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${TTL_SEC}`];
  if (isSecureRequest(req)) attrs.push("Secure");
  return attrs.join("; ");
}

module.exports = { SESSION_COOKIE, TTL_SEC, issueSessionToken, verifySessionToken, readSessionCookie, buildSessionCookie, isSecureRequest };
