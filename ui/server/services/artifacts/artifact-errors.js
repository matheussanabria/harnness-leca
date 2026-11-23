// @ts-check
// Errors of the ownership operations (EP-25.04). The controller maps `status` straight to the HTTP response.

const STATUS = Object.freeze({
  NOT_FOUND: 404,
  INVALID_OWNER: 404,
  SAME_OWNER: 409,
  COLLISION: 409,
  UNDO_NOT_ALLOWED: 409,
  CONFIRMATION_REQUIRED: 400,
  UNSUPPORTED_TYPE: 422,
  STORAGE: 500,
  REGISTRY_OFF: 503,
});

class ArtifactError extends Error {
  /** @param {keyof typeof STATUS} code @param {string} message @param {Record<string, unknown>} [details] */
  constructor(code, message, details) {
    super(message);
    this.name = "ArtifactError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

module.exports = { ArtifactError };
