// @ts-check
// Safe restart of the engine host (EP-23.05). "Draining" refuses new runs (503, code host-restarting) and waits for
// the active ones to finish, up to a limit (HARNESS_HOST_DRAIN_MS, default 10 min). Past the limit the host keeps
// draining and waits for a decision: force (active runs end as interrupted, EP-23.02) or cancel.
const { getRun, listActiveRuns } = require("../chat-run-registry.service");

const DEFAULT_LIMIT_MS = 10 * 60 * 1000;
const POLL_MS = 250;

/** @typedef {"idle"|"draining"|"timed-out"|"restarting"} DrainState */

/**
 * @param {{ onIdle: () => void, limitMs?: number, activeRuns?: () => string[], interruptRun?: (id: string) => void, pollMs?: number }} options
 *   onIdle: called once when no run is left (or after a force): the host restarts there.
 */
function createDrain({ onIdle, limitMs, activeRuns = listActiveRuns, interruptRun = (id) => getRun(id)?.interrupt(), pollMs = POLL_MS }) {
  const limit = Number(limitMs ?? process.env.HARNESS_HOST_DRAIN_MS) || DEFAULT_LIMIT_MS;
  /** @type {DrainState} */
  let state = "idle";
  let startedAt = 0;
  /** @type {NodeJS.Timeout | null} */
  let timer = null;

  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  function finish() {
    stopTimer();
    state = "restarting";
    onIdle();
  }

  function check() {
    if (state !== "draining" && state !== "timed-out") return;
    if (activeRuns().length === 0) return finish();
    if (state === "draining" && Date.now() - startedAt >= limit) state = "timed-out";
  }

  return {
    /** True while new runs must be refused. */
    refusing: () => state !== "idle",
    /** Starts draining (idempotent). */
    begin() {
      if (state === "idle") {
        state = "draining";
        startedAt = Date.now();
        timer = setInterval(check, pollMs);
        timer.unref?.();
      }
      check();
      return this.status();
    },
    /** Ends the active runs as interrupted and restarts now. */
    force() {
      if (state === "idle") return this.status();
      for (const id of activeRuns()) {
        try { interruptRun(id); } catch {}
      }
      finish();
      return this.status();
    },
    /** Gives up the restart and accepts new runs again. */
    cancel() {
      if (state === "draining" || state === "timed-out") {
        stopTimer();
        state = "idle";
      }
      return this.status();
    },
    status() {
      return { state, active: activeRuns().length, limitMs: limit, waitedMs: startedAt && state !== "idle" ? Date.now() - startedAt : 0 };
    },
  };
}

module.exports = { createDrain, DEFAULT_LIMIT_MS };
