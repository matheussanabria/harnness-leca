// @ts-check
// SSE helpers shared by the engine host and the legacy in-process chat routes (EP-23.03).
const { getRun } = require("../chat-run-registry.service");
const { readStoredRun } = require("../chat-run-journal.service");

/**
 * @param {import("http").ServerResponse} res
 * @param {Record<string, string>} [extraHeaders]
 */
function openSse(res, extraHeaders = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.flushHeaders?.();
}

/**
 * Attach a response to a run: live from memory, or replayed from the journal (EP-23.02) when it left memory.
 * @param {import("http").ServerResponse} res
 * @param {string} runId
 * @param {number} from
 * @param {Record<string, string>} [extraHeaders]
 * @returns {boolean} false when the run never existed (nothing was written)
 */
function attachRun(res, runId, from, extraHeaders = {}) {
  const run = getRun(runId);
  const stored = run ? null : readStoredRun(runId, from);
  if (!run && !stored) return false;
  openSse(res, extraHeaders);
  if (run) {
    run.attach(res, from);
    return true;
  }
  for (const event of stored?.events || []) res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.end();
  return true;
}

module.exports = { openSse, attachRun };
