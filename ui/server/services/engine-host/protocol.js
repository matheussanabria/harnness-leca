// @ts-check
// Engine host protocol (EP-23.03): where the host listens, how the web server finds it, the shared token and
// the protocol version both sides must agree on. The host listens on loopback only.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("../../../../tools/lib/root");
const { safeEqual } = require("../../../../tools/lib/network-auth");

/** Bump when a route or event shape changes in a way an older peer cannot handle. */
const PROTOCOL_VERSION = 1;
const DEFAULT_PORT = 4322;
const TOKEN_HEADER = "x-harness-host-token";

/** Engines run in the host unless HARNESS_ENGINE_HOST=0 (legacy in-process mode, the rollback). */
const isHostMode = () => process.env.HARNESS_ENGINE_HOST !== "0";

/** @returns {number} port the host binds (HARNESS_ENGINE_HOST_PORT; 0 picks a free port, used by tests) */
function hostPort() {
  const raw = process.env.HARNESS_ENGINE_HOST_PORT;
  return raw !== undefined && raw !== "" && Number.isInteger(Number(raw)) ? Number(raw) : DEFAULT_PORT;
}

/** @returns {string} base URL the web server calls (HARNESS_ENGINE_HOST_URL overrides; loopback only) */
function hostUrl() {
  const url = process.env.HARNESS_ENGINE_HOST_URL || `http://127.0.0.1:${hostPort()}`;
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) throw new Error("HARNESS_ENGINE_HOST_URL must be a loopback address");
  return url.replace(/\/+$/, "");
}

/** @returns {string} token file path (data/engine-host.token, git-ignored; HARNESS_ENGINE_HOST_TOKEN_FILE overrides) */
const tokenPath = () => process.env.HARNESS_ENGINE_HOST_TOKEN_FILE || path.join(ROOT, "data", "engine-host.token");

/** @returns {string | null} the token, or null when the host never started */
function readToken() {
  try {
    const token = fs.readFileSync(tokenPath(), "utf8").trim();
    return token || null;
  } catch {
    return null;
  }
}

/** Host side: reuse the saved token or create one on the first start (user-only file where the OS allows). */
function loadOrCreateToken() {
  const existing = readToken();
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString("hex");
  const file = tokenPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {string} token
 */
function tokenOk(req, token) {
  const sent = req.headers[TOKEN_HEADER];
  return typeof sent === "string" && sent.length > 0 && safeEqual(sent, token);
}

module.exports = { PROTOCOL_VERSION, DEFAULT_PORT, TOKEN_HEADER, isHostMode, hostPort, hostUrl, tokenPath, readToken, loadOrCreateToken, tokenOk };
