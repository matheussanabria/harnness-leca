// @ts-check
// Capture of a demand as a draft story. Idempotent by an optional client-sent dedupeKey; suggestions never block.
const { loadProjectScrum } = require("./project-scrum-persist");
const { upsertStory } = require("./project-scrum-ops");
const { findDuplicateCandidates, MAX_TITLE_LENGTH } = require("./project-scrum-duplicates");

const DEDUPE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

class CaptureError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

/** @param {unknown} value @returns {string|undefined} */
function validateDedupeKey(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (!DEDUPE_KEY_PATTERN.test(text)) throw new CaptureError("dedupeKey invalida: use 1 a 80 caracteres alfanumericos, ponto, dois-pontos, barra, hifen ou underscore.");
  return text;
}

/** @param {unknown} value @returns {string} */
function validateTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) throw new CaptureError("Parametro 'title' e obrigatorio.");
  if (title.length > MAX_TITLE_LENGTH) throw new CaptureError(`Titulo excede ${MAX_TITLE_LENGTH} caracteres.`);
  return title;
}

/** Suggestions for a title typed so far (read-only). */
function suggestDuplicates(slug, projectDir, repoRoot, query) {
  const title = validateTitle(query.title);
  const { scrum } = loadProjectScrum(slug, projectDir, repoRoot);
  return findDuplicateCandidates(scrum.stories, { title, key: query.key, dedupeKey: query.dedupeKey });
}

/**
 * @returns {{ story: any, duplicated: boolean, candidates: any[] }}
 */
function captureStory(slug, projectDir, repoRoot, payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const title = validateTitle(body.title);
  const dedupeKey = validateDedupeKey(body.dedupeKey);
  const before = loadProjectScrum(slug, projectDir, repoRoot).scrum.stories;
  if (dedupeKey) {
    const existing = before.find((story) => story.dedupeKey === dedupeKey);
    if (existing) return { story: existing, duplicated: true, candidates: [] };
  }
  const candidates = findDuplicateCandidates(before, { title, key: body.key, dedupeKey });
  // A fresh id means upsert can never resolve to (and overwrite) an existing story; a colliding key is dropped.
  const id = `us-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const keyTaken = candidates.some((candidate) => candidate.reason === "key");
  // Forced fields come last: the client cannot pick maturity, sprint, status or revision on capture.
  upsertStory(slug, projectDir, repoRoot, {
    id,
    title,
    description: body.description,
    acceptanceCriteria: body.acceptanceCriteria,
    epicId: body.epicId,
    points: body.points,
    priority: body.priority,
    ...(body.key && !keyTaken ? { key: String(body.key).trim() } : {}),
    ...(dedupeKey ? { dedupeKey } : {}),
    maturity: "draft",
    sprintId: null,
  });
  const story = loadProjectScrum(slug, projectDir, repoRoot).scrum.stories.find((item) => item.id === id) || null;
  return { story, duplicated: false, candidates };
}

module.exports = { captureStory, suggestDuplicates, CaptureError };
