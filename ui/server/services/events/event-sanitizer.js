// @ts-check
// Sanitizador de payload do event log (ADR-TEL-007): metadado por padrao, sem segredo, sem texto
// de prompt, com limites de profundidade, quantidade e tamanho. Roda no ingest, antes do SQLite.
//
// Politica:
//  - chave que parece segredo (password, secret, *_token, api_key, authorization...) tem o valor
//    substituido por "[redacted]"; "tokens" (contagem de uso) NAO e segredo e passa;
//  - chave que carrega texto de prompt/saida (prompt, content, stdout...) e removida, salvo com a
//    flag explicita HARNESS_EVENTS_CAPTURE_CONTENT=1 (entao o payload ganha contentCaptured=true);
//  - valores string com formato de segredo (chaves sk-, ghp_, Bearer, JWT, PEM, VAR_KEY=valor) sao mascarados;
//  - limites: profundidade, chaves por objeto, itens por array, tamanho de string e do payload final.

const REDACTED = "[redacted]";
const TRUNCATED = "[truncated]";
const LIMITS = { depth: 6, keys: 50, items: 100, string: 2000, bytes: 64 * 1024 };

const SECRET_KEY = /(^|_)(password|passwd|pwd|secret|token|api_?key|apikey|authorization|cookie|credentials?|private_?key|bearer|access_?key|session_?key)$|secret|password/;
const TEXT_KEYS = new Set([
  "prompt", "user_prompt", "system_prompt", "completion", "response_text", "content", "text",
  "messages", "tool_input", "tool_output", "tool_args", "arguments", "stdout", "stderr", "file_contents",
]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const SECRET_VALUES = [
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
];
const ENV_PAIR = /\b([A-Za-z][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD))=\S+/g;

/** @param {string} key */
function normalizeKey(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-\s.]+/g, "_").toLowerCase();
}

/** @param {string} key */
function isSecretKey(key) {
  return SECRET_KEY.test(normalizeKey(key));
}

/** @param {string} key */
function isTextKey(key) {
  return TEXT_KEYS.has(normalizeKey(key));
}

/** @returns {boolean} flag explicita de captura de texto (desligada por padrao) */
function contentCaptureEnabled() {
  return process.env.HARNESS_EVENTS_CAPTURE_CONTENT === "1";
}

/**
 * @param {string} value
 * @param {{ redacted: number }} stats
 * @returns {string}
 */
function cleanString(value, stats) {
  let out = value;
  for (const re of SECRET_VALUES) {
    out = out.replace(re, () => {
      stats.redacted += 1;
      return REDACTED;
    });
  }
  out = out.replace(ENV_PAIR, (_m, name) => {
    stats.redacted += 1;
    return `${name}=${REDACTED}`;
  });
  return out.length > LIMITS.string ? `${out.slice(0, LIMITS.string)}${TRUNCATED}` : out;
}

/**
 * @param {any} value
 * @param {number} depth
 * @param {{ redacted: number, dropped: number, truncated: number, keptText: boolean }} stats
 * @param {boolean} allowText
 * @returns {any}
 */
function walk(value, depth, stats, allowText) {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return cleanString(value, stats);
  if (typeof value !== "object") return null;
  if (depth >= LIMITS.depth) {
    stats.truncated += 1;
    return TRUNCATED;
  }
  if (Array.isArray(value)) {
    if (value.length > LIMITS.items) stats.truncated += 1;
    return value.slice(0, LIMITS.items).map((item) => walk(item, depth + 1, stats, allowText));
  }
  /** @type {Record<string, any>} */
  const out = {};
  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      stats.dropped += 1;
      continue;
    }
    if (count >= LIMITS.keys) {
      stats.truncated += 1;
      break;
    }
    if (isSecretKey(key)) {
      out[key] = REDACTED;
      stats.redacted += 1;
    } else if (isTextKey(key) && !allowText) {
      stats.dropped += 1;
      continue;
    } else {
      if (isTextKey(key)) stats.keptText = true;
      out[key] = walk(child, depth + 1, stats, allowText);
    }
    count += 1;
  }
  return out;
}

/**
 * Sanitiza o payload de um evento. Devolve o payload limpo e contadores do que foi tratado.
 * `ok=false` indica que o payload final excede o teto de bytes (o chamador decide rejeitar).
 * @param {any} payload
 * @param {{ allowText?: boolean }} [options]
 * @returns {{ payload: Record<string, any>, ok: boolean, bytes: number, redacted: number, dropped: number, truncated: number }}
 */
function sanitizePayload(payload, options = {}) {
  const stats = { redacted: 0, dropped: 0, truncated: 0, keptText: false };
  const allowText = options.allowText === undefined ? contentCaptureEnabled() : options.allowText;
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const clean = walk(source, 0, stats, allowText);
  if (stats.keptText) clean.contentCaptured = true;
  const bytes = Buffer.byteLength(JSON.stringify(clean));
  return { payload: clean, ok: bytes <= LIMITS.bytes, bytes, redacted: stats.redacted, dropped: stats.dropped, truncated: stats.truncated };
}

module.exports = { sanitizePayload, isSecretKey, isTextKey, contentCaptureEnabled, LIMITS, REDACTED, TRUNCATED };
