// @ts-check
// Ponto unico de ingest do event log (ADR-TEL-002/004/007): valida, sanitiza e so entao grava.
// Usado pelo POST /events; produtores externos novos devem passar por aqui, nao por appendEvent.
//
// Validacoes (todas devolvem IngestError com codigo estavel e mensagem generica):
//  - tipo obrigatorio e dentro da allowlist (apos resolver aliases);
//  - trust=declared proibido (contrato congelado: so observed ou inferred); outros valores
//    desconhecidos seguem o comportamento antigo (viram "observed");
//  - envelope v1: relation no enum, schemaVersion suportado, ids textuais com tamanho limitado;
//  - payload objeto, sanitizado e abaixo do teto de bytes.
const { appendEvent, TYPE_ALIASES } = require("./event-store");
const { isAllowedType } = require("./event-type-allowlist");
const { sanitizePayload } = require("./event-sanitizer");
const { ID_FIELDS, RELATIONS, MAX_ID_LENGTH, SCHEMA_VERSION } = require("./event-envelope");

class IngestError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = "IngestError";
    this.code = code;
    this.status = status;
  }
}

/** @param {unknown} value */
function isBlank(value) {
  return value === undefined || value === null || value === "";
}

/**
 * @param {any} body
 */
function validateEnvelope(body) {
  if (!isBlank(body.relation) && !RELATIONS.has(String(body.relation))) {
    throw new IngestError("invalid_relation", `relation must be one of: ${[...RELATIONS].join(", ")}.`);
  }
  if (!isBlank(body.schemaVersion)) {
    const version = Number(body.schemaVersion);
    if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
      throw new IngestError("unsupported_schema_version", `schemaVersion must be an integer between 1 and ${SCHEMA_VERSION}.`);
    }
  }
  for (const [key] of ID_FIELDS) {
    const value = body[key];
    if (isBlank(value)) continue;
    if ((typeof value !== "string" && typeof value !== "number") || String(value).length > MAX_ID_LENGTH) {
      throw new IngestError("invalid_envelope_field", `${key} must be a string of at most ${MAX_ID_LENGTH} characters.`);
    }
  }
}

/**
 * Valida e sanitiza uma entrada, devolvendo o evento pronto para o store.
 * @param {any} body
 * @returns {{ input: Record<string, any>, sanitized: { redacted: number, dropped: number, truncated: number } }}
 */
function prepareEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new IngestError("invalid_body", "The event must be a JSON object.");
  }
  const rawType = String(body.type ?? "").trim();
  if (!rawType) throw new IngestError("missing_type", "The event type is required.");
  const type = TYPE_ALIASES[rawType] || rawType;
  if (!isAllowedType(type)) {
    throw new IngestError("unknown_type", `Event type '${rawType.slice(0, 80)}' is not allowed.`, 422);
  }
  if (body.trust === "declared") {
    throw new IngestError("trust_declared_forbidden", "trust must be 'observed' or 'inferred'; 'declared' is not accepted.", 422);
  }
  if (!isBlank(body.payload) && (typeof body.payload !== "object" || Array.isArray(body.payload))) {
    throw new IngestError("invalid_payload", "payload must be a JSON object.");
  }
  validateEnvelope(body);
  const clean = sanitizePayload(body.payload);
  if (!clean.ok) {
    throw new IngestError("payload_too_large", "The event payload exceeds the allowed size.", 413);
  }
  // ingestedAt e do servidor: qualquer valor enviado pelo cliente e descartado.
  const { ingestedAt: _ignored, ...rest } = body;
  return {
    input: { ...rest, type, payload: clean.payload },
    sanitized: { redacted: clean.redacted, dropped: clean.dropped, truncated: clean.truncated },
  };
}

/**
 * Ingest completo: prepara e grava. Replay do mesmo id ou idempotencyKey e no-op.
 * @param {string} slug
 * @param {any} body
 * @returns {{ event: any, cursor: string, duplicated: boolean, sanitized: { redacted: number, dropped: number, truncated: number } }}
 */
function ingestEvent(slug, body) {
  const { input, sanitized } = prepareEvent(body);
  return { ...appendEvent(slug, input), sanitized };
}

module.exports = { ingestEvent, prepareEvent, IngestError };
