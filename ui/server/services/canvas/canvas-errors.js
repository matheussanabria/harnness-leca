// @ts-check

/**
 * Error type shared by the canvas service layer.
 * Controllers translate it into an HTTP response using status/code/details.
 */
class CanvasError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} status
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, code, status, details = {}) {
    super(message);
    this.name = "CanvasError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * @param {string} message
 * @param {string} code
 * @param {number} status
 * @param {Record<string, unknown>} [details]
 * @returns {CanvasError}
 */
function canvasError(message, code, status, details) {
  return new CanvasError(message, code, status, details);
}

// Storage messages are deliberately generic: never leak filesystem paths.
function storageError() {
  return canvasError("Falha ao acessar o armazenamento do canvas.", "STORAGE_ERROR", 500);
}

function corruptFile() {
  return canvasError("Arquivo de dados invalido.", "CORRUPT_FILE", 500);
}

function invalidStoredBoard() {
  return canvasError("Arquivo de board invalido.", "INVALID_STORED_BOARD", 500);
}

function invalidJson() {
  return canvasError("JSON invalido.", "INVALID_JSON", 400);
}

function invalidBody() {
  return canvasError("Corpo da requisicao invalido.", "INVALID_BODY", 400);
}

function invalidId() {
  return canvasError("Identificador de board invalido.", "INVALID_ID", 400);
}

function invalidKind() {
  return canvasError("O tipo do board deve ser board, mindmap, diagram ou flow.", "INVALID_KIND", 400);
}

function invalidTitle() {
  return canvasError("O titulo deve ter de 1 a 120 caracteres.", "INVALID_TITLE", 400);
}

function invalidData() {
  return canvasError("O campo data deve ser um objeto JSON.", "INVALID_DATA", 400);
}

/** @param {string} kind */
function invalidSchema(kind) {
  return canvasError(`O conteudo nao corresponde ao formato do tipo ${kind}.`, "INVALID_SCHEMA", 400, { kind });
}

function boardTooLarge() {
  return canvasError("O conteudo do board excede o limite de 4 MB.", "BOARD_TOO_LARGE", 413);
}

function projectRequired() {
  return canvasError("O parametro project e obrigatorio.", "PROJECT_REQUIRED", 400);
}

/**
 * @param {string} project
 * @returns {CanvasError}
 */
function projectNotFound(project) {
  return canvasError(`Projeto nao encontrado: ${project}`, "PROJECT_NOT_FOUND", 404);
}

/**
 * @param {string} id
 * @returns {CanvasError}
 */
function boardNotFound(id) {
  return canvasError(`Board nao encontrado: ${id}`, "BOARD_NOT_FOUND", 404);
}

function revisionRequired() {
  return canvasError("A revisao do board e obrigatoria.", "REVISION_REQUIRED", 400);
}

/**
 * @param {number} currentRev
 * @returns {CanvasError}
 */
function revisionConflict(currentRev) {
  return canvasError("Revisao desatualizada.", "REVISION_CONFLICT", 409, { currentRev });
}

/**
 * @param {unknown} version
 * @returns {CanvasError}
 */
function unsupportedVersion(version) {
  return canvasError("Versao de board nao suportada.", "UNSUPPORTED_VERSION", 422, { version });
}

function unsupportedAssetType() {
  return canvasError("Tipo de arquivo nao suportado.", "UNSUPPORTED_ASSET_TYPE", 415);
}

function assetTooLarge() {
  return canvasError("O arquivo excede o limite de 25 MB.", "ASSET_TOO_LARGE", 413);
}

function emptyAsset() {
  return canvasError("Arquivo vazio.", "EMPTY_ASSET", 400);
}

function boardAssetsFull() {
  return canvasError("Os anexos do board excedem o limite de 200 MB.", "BOARD_ASSETS_FULL", 413);
}

function invalidAsset() {
  return canvasError("Identificador de asset invalido.", "INVALID_ASSET", 400);
}

function assetNotFound() {
  return canvasError("Asset nao encontrado.", "ASSET_NOT_FOUND", 404);
}

module.exports = {
  CanvasError,
  canvasError,
  storageError,
  corruptFile,
  invalidStoredBoard,
  invalidJson,
  invalidBody,
  invalidId,
  invalidKind,
  invalidTitle,
  invalidData,
  invalidSchema,
  boardTooLarge,
  projectRequired,
  projectNotFound,
  boardNotFound,
  revisionRequired,
  revisionConflict,
  unsupportedVersion,
  unsupportedAssetType,
  assetTooLarge,
  emptyAsset,
  boardAssetsFull,
  invalidAsset,
  assetNotFound,
};
