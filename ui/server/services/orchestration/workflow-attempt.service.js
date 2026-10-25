// @ts-check
// Attempt model for workflow stages (story T4.1c, design doc 08 section 2/4).
// Pure and in-memory like the runner state: one attempt is one try at a stage.
//
// Rules:
//  - an attempt opens when a stage is started (or its outcome is reported by an
//    old-style caller that never sent `started`) and has no open attempt; it may
//    reopen after `blocked` (and after `failed` when retry is enabled), giving
//    attemptNo N+1;
//  - a repeated `started` while an attempt is open is idempotent (no second
//    attempt with a new id);
//  - an attempt closes on completed, failed, blocked or cancelled outcomes;
//  - `decorate` also attaches the optional declared engine session to the open
//    attempt and puts attempt fields into the task payload sent to events.
const crypto = require("node:crypto");

const OUTCOMES = new Set(["completed", "failed", "blocked", "cancelled"]);
const VALIDATION_STATUSES = new Set(["not_evaluated", "passed", "failed"]);
const DEFAULT_VALIDATION_STATUS = "not_evaluated";
const SESSION_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const MAX_SHORT_ID = 120;

/** @param {any} run @param {string} stageId @returns {any} */
function stageOf(run, stageId) {
  const list = run?.stageState || run?.stages || [];
  const id = String(stageId || "").trim();
  return list.find((item) => item && item.id === id) || null;
}

/** Attempts are carried by the per-stage state of the run (never a new store). */
function ensureStage(run, stageId) {
  const stage = stageOf(run, stageId);
  if (!stage) return null;
  if (!Array.isArray(stage.attempts)) stage.attempts = [];
  if (typeof stage.attemptNo !== "number") stage.attemptNo = 0;
  return stage;
}

/**
 * Open attempt, or the already open one (idempotent). Never throws.
 * @param {any} run @param {string} stageId
 * @returns {{ attemptId: string, attemptNo: number }}
 */
function openAttempt(run, stageId) {
  const stage = ensureStage(run, stageId);
  if (!stage) return { attemptId: "", attemptNo: 0 };
  if (stage.openAttempt) {
    return { attemptId: stage.openAttempt.attemptId, attemptNo: stage.openAttempt.attemptNo };
  }
  stage.attemptNo += 1;
  const attempt = {
    attemptId: `att-${crypto.randomUUID()}`,
    attemptNo: stage.attemptNo,
    openedAt: new Date().toISOString(),
    closedAt: "",
    outcome: "",
    declaredSessionId: "",
  };
  stage.openAttempt = attempt;
  return { attemptId: attempt.attemptId, attemptNo: attempt.attemptNo };
}

/** The currently open attempt of the stage, or null. */
function currentAttempt(run, stageId) {
  const stage = ensureStage(run, stageId);
  return stage?.openAttempt || null;
}

/** Closes the open attempt with the given terminal outcome. Returns it (or null). */
function closeAttempt(run, stageId, outcome) {
  const stage = ensureStage(run, stageId);
  const open = stage?.openAttempt;
  if (!open) return null;
  open.outcome = OUTCOMES.has(String(outcome)) ? String(outcome) : "";
  open.closedAt = new Date().toISOString();
  stage.attempts.push({
    attemptId: open.attemptId,
    attemptNo: open.attemptNo,
    openedAt: open.openedAt,
    closedAt: open.closedAt,
    outcome: open.outcome,
    declaredSessionId: open.declaredSessionId,
  });
  stage.openAttempt = null;
  return { attemptId: open.attemptId, attemptNo: open.attemptNo };
}

function isSessionId(value) {
  return typeof value === "string" && SESSION_PATTERN.test(value.trim());
}

/**
 * Declares the engine session on the open attempt (declared, engine-reported).
 * Invalid values are safely ignored. Returns the stored id or "".
 * @param {any} run @param {string} stageId @param {unknown} value
 */
function declareSession(run, stageId, value) {
  if (!isSessionId(value)) return "";
  const session = String(value).trim();
  const open = currentAttempt(run, stageId);
  if (!open) return "";
  if (!open.declaredSessionId) open.declaredSessionId = session;
  return session;
}

/**
 * Builds the task payload with attempt fields; opens an attempt when none is
 * open (idempotent), so every task.* event carries attemptId and attemptNo.
 * @param {any} run @param {string} stageId @param {Record<string, any>} payload @param {unknown} sessionValue
 */
function decorate(run, stageId, payload = {}, sessionValue) {
  const base = payload && typeof payload === "object" ? payload : {};
  const attempt = openAttempt(run, stageId);
  if (!attempt.attemptId) return { ...base };
  const out = {
    ...base,
    attemptId: attempt.attemptId,
    attemptNo: attempt.attemptNo,
  };
  const session = declareSession(run, stageId, sessionValue);
  if (session) out.declaredSessionId = session;
  return out;
}

/** @param {unknown} value @returns {string | null} */
function shortId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().slice(0, MAX_SHORT_ID);
  return text || null;
}

/**
 * Normalizes the optional `validation` of a completed stage. Invalid values
 * become safe defaults; the request is never rejected.
 * @param {unknown} value
 */
function normalizeValidation(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = VALIDATION_STATUSES.has(input.status) ? String(input.status) : DEFAULT_VALIDATION_STATUS;
  return { status, criterionId: shortId(input.criterionId), evidenceRef: shortId(input.evidenceRef) };
}

module.exports = {
  OUTCOMES,
  VALIDATION_STATUSES,
  DEFAULT_VALIDATION_STATUS,
  SESSION_PATTERN,
  openAttempt,
  currentAttempt,
  closeAttempt,
  declareSession,
  decorate,
  normalizeValidation,
};
