// @ts-check
// Chat run journal (EP-23.02): the durable side of chat-run-registry. Opens the host database lazily, marks
// runs left running by a previous process as interrupted, prunes old runs, scrubs secrets from every event
// before it is stored, and rebuilds a finished run for GET /api/chat/attach after it left memory.
// HARNESS_RUN_JOURNAL=0 turns it off (memory only, the pre-EP-23.02 behaviour).
// Fails open: if the database cannot be opened or written, the chat keeps working from memory.
const { getDb } = require("../db/connection");
const { createChatRunsRepo } = require("../db/repos/chat-runs.repo");
const { FORMAT_RULES } = require("../../../tools/lib/redact");

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;
const SECRET_ENV_NAME = /TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|AUTH|COOKIE|SESSION/i;
const MIN_SECRET_LENGTH = 8;

/** @typedef {ReturnType<typeof createChatRunsRepo>} ChatRunsRepo */

/** @type {ChatRunsRepo | null | undefined} undefined = not opened yet */
let journal;

/** @param {string} where @param {unknown} error */
function warn(where, error) {
  console.warn(`[chat-run-journal] ${where}:`, (error && /** @type {any} */ (error).message) || error);
}

/** @param {ChatRunsRepo} repo */
function prepareOnBoot(repo) {
  const interrupted = repo.markInterruptedOnBoot();
  if (interrupted) console.log(`[chat-run-journal] ${interrupted} run(s) of a previous process marked interrupted`);
  pruneOld(repo);
  const timer = setInterval(() => pruneOld(repo), PRUNE_EVERY_MS);
  timer.unref?.();
}

/** @param {ChatRunsRepo} repo */
function pruneOld(repo) {
  try {
    repo.prune(new Date(Date.now() - RETENTION_MS).toISOString());
  } catch (error) {
    warn("prune", error);
  }
}

/** @returns {ChatRunsRepo | null} the journal, or null when disabled or unavailable */
function getJournal() {
  if (journal !== undefined) return journal;
  if (process.env.HARNESS_RUN_JOURNAL === "0") return (journal = null);
  try {
    const repo = createChatRunsRepo(getDb());
    prepareOnBoot(repo);
    journal = repo;
  } catch (error) {
    warn("open", error);
    journal = null;
  }
  return journal;
}

/** Tests inject an in-memory repository (or null to disable); undefined resets to lazy opening. */
function setJournal(/** @type {ChatRunsRepo | null | undefined} */ repo) {
  journal = repo;
}

/** Values of environment variables whose names look secret, longest first. */
function secretEnvValues() {
  return Object.entries(process.env)
    .filter(([name, value]) => SECRET_ENV_NAME.test(name) && typeof value === "string" && value.length >= MIN_SECRET_LENGTH)
    .map(([, value]) => /** @type {string} */ (value))
    .sort((a, b) => b.length - a.length);
}

/** @param {string} text @param {string[]} envValues */
function scrubText(text, envValues) {
  let out = text;
  for (const value of envValues) if (out.includes(value)) out = out.split(value).join("[REDIGIDO:env]");
  for (const [re, to] of FORMAT_RULES) out = out.replace(re, /** @type {any} */ (to));
  return out;
}

/**
 * Deep copy of an event with secrets removed from every string (env values and known credential formats).
 * @template T @param {T} event @param {string[]} [envValues] @returns {T}
 */
function scrubEvent(event, envValues = secretEnvValues()) {
  /** @param {any} value @returns {any} */
  const walk = (value) => {
    if (typeof value === "string") return scrubText(value, envValues);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(event);
}

// EP-23.04: why a run ended without an answer. The browser shows the partial answer as "Interrompida" with the
// reason and offers to resume it in the same engine session or to send the message again.
const STOP_REASONS = {
  restart: { code: "interrupted", title: "Resposta interrompida", error: "O servidor reiniciou antes do fim da resposta. O trecho acima foi salvo." },
  user: { code: "stopped", title: "Resposta parada", error: "A resposta foi parada antes do fim." },
  idle: { code: "stopped", title: "Resposta interrompida", error: "A resposta foi encerrada porque ficou tempo demais sem ninguém acompanhando." },
};

/**
 * Final event of a run that ended without an answer (EP-23.04).
 * @param {"restart"|"user"|"idle"} reason
 */
function stoppedEvent(reason) {
  const info = STOP_REASONS[reason] || STOP_REASONS.restart;
  return { type: "error", code: info.code, reason, title: info.title, error: info.error, retryable: true, interrupted: true };
}

/** Status in chat_runs to the reason shown for a run without a final event. */
const ENDED_WITHOUT_ANSWER = { interrupted: "restart", stopped: "user" };

/**
 * A run that is no longer in memory, rebuilt from the journal. Interrupted or stopped runs without a final
 * event get a synthetic error event (not stored) so the client ends the stream instead of reattaching forever.
 * @param {string} runId @param {number} from
 * @returns {{ status: string, events: Record<string, any>[] } | null} null when the run never existed
 */
function readStoredRun(runId, from) {
  const repo = getJournal();
  if (!repo || !runId) return null;
  try {
    const run = repo.getRun(runId);
    if (!run) return null;
    const events = repo.readFrom(runId, from);
    const reason = /** @type {Record<string, any>} */ (ENDED_WITHOUT_ANSWER)[run.status];
    if (reason && !repo.hasTerminalEvent(runId)) events.push({ ...stoppedEvent(reason), seq: run.lastSeq + 1 });
    return { status: run.status, events, resumedFrom: run.resumedFrom };
  } catch (error) {
    warn("read", error);
    return null;
  }
}

module.exports = { getJournal, setJournal, scrubEvent, readStoredRun, stoppedEvent, RETENTION_MS };
