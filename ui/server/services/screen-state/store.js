// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const { getProjects, getRoot, slugs } = require("../../config");
const {
  MAX_STATE_BYTES,
  ScreenStateError,
  getScreen,
  sanitizeState,
  stateBytes,
} = require("./registry");

const STATE_VERSION = 1;
const HISTORY_LIMIT = 500;
const HISTORY_DEFAULT_LIMIT = 500;
const HISTORY_MAX_ACAO = 200;
const HISTORY_MAX_ALVO = 300;
const HISTORY_MAX_TS = 64;
const MAX_STATE_FILE_BYTES = MAX_STATE_BYTES * 4;
const MAX_HISTORY_FILE_BYTES = HISTORY_LIMIT * 1024;

class ScreenStoreError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} status
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, code, status, details = {}) {
    super(message);
    this.name = "ScreenStoreError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function storageError() {
  return new ScreenStoreError("Falha ao acessar o armazenamento da tela.", "STORAGE_ERROR", 500);
}

function screenOrThrow(screenId) {
  const screen = getScreen(screenId);
  if (!screen) {
    throw new ScreenStoreError(`Tela desconhecida: ${screenId}`, "UNKNOWN_SCREEN", 404);
  }
  return screen;
}

function projectOrThrow(project) {
  const slug = typeof project === "string" ? project.trim() : "";
  if (!slug) {
    throw new ScreenStoreError("O parâmetro project é obrigatório para telas de projeto.", "PROJECT_REQUIRED", 400);
  }
  if (!slugs().includes(slug)) {
    throw new ScreenStoreError(`Projeto não encontrado: ${slug}`, "PROJECT_NOT_FOUND", 404);
  }
  return slug;
}

function scopeDirectory(screen, project) {
  if (screen.escopo === "global") return path.join(getRoot(), "global", "ui-state");
  return path.join(getProjects(), projectOrThrow(project), "ui-state");
}

function screenLocation(screenId, project) {
  const screen = screenOrThrow(screenId);
  const slug = screen.escopo === "global" ? null : projectOrThrow(project);
  const dir = scopeDirectory(screen, slug);
  return {
    screen,
    project: slug,
    dir,
    stateFile: path.join(dir, `${screen.id}.json`),
    historyFile: path.join(dir, `${screen.id}.history.jsonl`),
  };
}

function ensureDirectory(dir) {
  if (fs.existsSync(dir)) {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageError();
    return;
  }
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {
    throw storageError();
  }
}

function assertRegularFile(file, maxBytes = MAX_STATE_FILE_BYTES) {
  if (!fs.existsSync(file)) return false;
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw storageError();
  if (stat.size > maxBytes) throw storageError();
  return true;
}

function readStateFile(file, screenId) {
  if (!assertRegularFile(file, MAX_STATE_FILE_BYTES)) return { rev: 0, state: {}, updatedAt: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("estado invalido");
    const rawState = parsed.state && typeof parsed.state === "object" && !Array.isArray(parsed.state)
      ? parsed.state
      : parsed;
    const rev = Number.isInteger(parsed.rev) && parsed.rev >= 0 ? parsed.rev : 0;
    return {
      rev,
      state: sanitizeState(screenId, rawState),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    if (error instanceof ScreenStateError) throw storageError();
    throw storageError();
  }
}

function atomicWrite(file, content) {
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw storageError();
  }
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  try {
    fs.writeFileSync(tmp, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, file);
  } catch {
    try { fs.unlinkSync(tmp); } catch {}
    throw storageError();
  }
}

function sanitizeOrThrow(screenId, value) {
  try {
    return sanitizeState(screenId, value);
  } catch (error) {
    if (error instanceof ScreenStateError && error.code === "STATE_TOO_LARGE") {
      throw new ScreenStoreError(error.message, "STATE_TOO_LARGE", 413);
    }
    throw new ScreenStoreError(
      error instanceof Error ? error.message : "Estado inválido.",
      "INVALID_STATE",
      400
    );
  }
}

function readScreenState(screenId, project) {
  const location = screenLocation(screenId, project);
  const current = readStateFile(location.stateFile, screenId);
  return { rev: current.rev, state: current.state, updatedAt: current.updatedAt };
}

function normalizeRevision(value) {
  if (value === undefined || value === null) return undefined;
  const rev = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(rev) || rev < 0) {
    throw new ScreenStoreError("A revisão deve ser um inteiro maior ou igual a zero.", "INVALID_REVISION", 400);
  }
  return rev;
}

function patchScreenState(screenId, project, patch, expectedRev) {
  const location = screenLocation(screenId, project);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new ScreenStoreError("Estado inválido.", "INVALID_STATE", 400);
  }
  if (stateBytes(patch) > MAX_STATE_BYTES) {
    throw new ScreenStoreError(`Estado acima de ${MAX_STATE_BYTES} bytes.`, "STATE_TOO_LARGE", 413);
  }

  const current = readStateFile(location.stateFile, screenId);
  const rev = normalizeRevision(expectedRev);
  if (rev !== undefined && rev !== current.rev) {
    throw new ScreenStoreError("Revisão desatualizada.", "REVISION_CONFLICT", 409, {
      rev: current.rev,
      currentRev: current.rev,
    });
  }

  const sanitizedPatch = sanitizeOrThrow(screenId, patch);
  const merged = sanitizeOrThrow(screenId, { ...current.state, ...sanitizedPatch });
  // null remove o campo (como no JSON merge-patch): é a única forma de limpar uma seleção ou um filtro.
  for (const name of Object.keys(patch)) {
    if (patch[name] === null && Object.prototype.hasOwnProperty.call(location.screen.campos, name)) delete merged[name];
  }
  const updatedAt = new Date().toISOString();
  ensureDirectory(location.dir);
  atomicWrite(
    location.stateFile,
    `${JSON.stringify({ _v: STATE_VERSION, rev: current.rev + 1, updatedAt, state: merged })}\n`
  );
  return { rev: current.rev + 1, state: merged, updatedAt };
}

function normalizeHistoryEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ScreenStoreError("Ação de histórico inválida.", "INVALID_HISTORY", 400);
  }
  const acao = typeof input.acao === "string" ? input.acao.trim() : "";
  if (!acao || acao.length > HISTORY_MAX_ACAO) {
    throw new ScreenStoreError("O campo acao é obrigatório e tem limite de 200 caracteres.", "INVALID_HISTORY", 400);
  }
  const alvo = input.alvo === undefined || input.alvo === null ? "" : input.alvo;
  if (typeof alvo !== "string" || alvo.length > HISTORY_MAX_ALVO) {
    throw new ScreenStoreError("O campo alvo deve ser texto de até 300 caracteres.", "INVALID_HISTORY", 400);
  }
  const ts = input.ts === undefined || input.ts === null ? new Date().toISOString() : input.ts;
  if (typeof ts !== "string" || !ts || ts.length > HISTORY_MAX_TS) {
    throw new ScreenStoreError("O campo ts deve ser texto de até 64 caracteres.", "INVALID_HISTORY", 400);
  }
  return { acao, alvo, ts };
}

function parseHistoryLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.acao !== "string" || typeof parsed.alvo !== "string" || typeof parsed.ts !== "string") {
      return null;
    }
    return { acao: parsed.acao, alvo: parsed.alvo, ts: parsed.ts };
  } catch {
    return null;
  }
}

function readHistoryLines(file) {
  if (!assertRegularFile(file, MAX_HISTORY_FILE_BYTES)) return [];
  try {
    return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  } catch {
    throw storageError();
  }
}

function readScreenHistory(screenId, project, limit) {
  const location = screenLocation(screenId, project);
  const parsedLimit = Number(limit);
  const max = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), HISTORY_LIMIT)
    : HISTORY_DEFAULT_LIMIT;
  const entries = readHistoryLines(location.historyFile).map(parseHistoryLine).filter(Boolean);
  return { history: entries.slice(-max).reverse(), total: entries.length };
}

function trimHistory(file) {
  const lines = readHistoryLines(file);
  if (lines.length <= HISTORY_LIMIT) return lines.length;
  const kept = lines.slice(-HISTORY_LIMIT);
  atomicWrite(file, `${kept.join("\n")}\n`);
  return kept.length;
}

function appendScreenHistory(screenId, project, input) {
  const location = screenLocation(screenId, project);
  const entry = normalizeHistoryEntry(input);
  ensureDirectory(location.dir);
  assertRegularFile(location.historyFile, MAX_HISTORY_FILE_BYTES);
  try {
    fs.appendFileSync(location.historyFile, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
  } catch {
    throw storageError();
  }
  return { entry, total: trimHistory(location.historyFile) };
}

module.exports = {
  STATE_VERSION,
  HISTORY_LIMIT,
  HISTORY_DEFAULT_LIMIT,
  ScreenStoreError,
  screenLocation,
  readScreenState,
  patchScreenState,
  readScreenHistory,
  appendScreenHistory,
};
