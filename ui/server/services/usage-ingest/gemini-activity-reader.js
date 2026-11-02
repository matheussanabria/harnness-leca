// @ts-check
// Read-only activity counter for Antigravity/Gemini transcripts
// (<brain>/<session>/.system_generated/logs/transcript.jsonl). Gemini reports no token usage there, so only
// step counts per UTC day are produced. The only keys read from each line are `type`, `status` and
// `created_at`; content, thinking, tool calls and paths are never kept. Failures degrade to a warning.
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_FILES = 3000;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_BYTES_PER_READ = 96 * 1024 * 1024;
const MAX_DAYS = 400;
const TRANSCRIPT = path.join(".system_generated", "logs", "transcript.jsonl");

/** @typedef {{ day: string, sessions: number, prompts: number, responses: number, errors: number }} DayActivity */

/** @returns {string} */
function defaultBrainDir() {
  return process.env.HARNESS_GEMINI_DIR || path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");
}

/** @param {string} text @returns {Map<string, { prompts: number, responses: number, errors: number }>} */
function countLines(text) {
  const days = new Map();
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let type = "";
    let at = "";
    try {
      const o = JSON.parse(line);
      type = typeof o.type === "string" ? o.type : "";
      at = typeof o.created_at === "string" ? o.created_at : "";
    } catch {
      continue;
    }
    const t = Date.parse(at);
    if (!type || Number.isNaN(t)) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    const d = days.get(day) || { prompts: 0, responses: 0, errors: 0 };
    if (type === "USER_INPUT") d.prompts += 1;
    else if (type === "PLANNER_RESPONSE") d.responses += 1;
    else if (type === "ERROR_MESSAGE") d.errors += 1;
    days.set(day, d);
  }
  return days;
}

/** @param {{ brainDir?: string, warn?: (msg: string) => void }} [opts] */
function createGeminiActivityReader(opts = {}) {
  const brainDir = opts.brainDir || defaultBrainDir();
  const warn = opts.warn || (() => {});
  /** @type {Map<string, { sig: string, days: ReturnType<typeof countLines> }>} */
  const cache = new Map();

  return {
    read() {
      /** @type {string[]} */
      const warnings = [];
      let entries = [];
      try {
        entries = fs.readdirSync(brainDir).slice(0, MAX_FILES);
      } catch {
        const msg = "Gemini transcript directory not found";
        warn(msg);
        return { days: [], sessions: 0, partial: false, warnings: [msg] };
      }
      let budget = MAX_BYTES_PER_READ;
      let partial = false;
      let skipped = 0;
      let sessions = 0;
      /** @type {Map<string, DayActivity>} */
      const merged = new Map();
      for (const entry of entries) {
        const file = path.join(brainDir, entry, TRANSCRIPT);
        let st;
        try { st = fs.statSync(file); } catch { continue; }
        if (st.size > MAX_FILE_BYTES) { skipped += 1; continue; }
        const sig = `${st.size}:${Math.floor(st.mtimeMs)}`;
        let hit = cache.get(file);
        if (!hit || hit.sig !== sig) {
          if (st.size > budget) { partial = true; continue; }
          budget -= st.size;
          try { hit = { sig, days: countLines(fs.readFileSync(file, "utf8")) }; } catch { continue; }
          cache.set(file, hit);
        }
        sessions += 1;
        for (const [day, c] of hit.days) {
          const d = merged.get(day) || { day, sessions: 0, prompts: 0, responses: 0, errors: 0 };
          d.sessions += 1; d.prompts += c.prompts; d.responses += c.responses; d.errors += c.errors;
          merged.set(day, d);
        }
      }
      if (skipped) warnings.push(`${skipped} oversized transcript(s) skipped`);
      if (partial) warnings.push("read budget reached; counts are partial until the next refresh");
      for (const w of warnings) warn(w);
      const days = [...merged.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, MAX_DAYS);
      return { days, sessions, partial, warnings };
    },
  };
}

module.exports = { createGeminiActivityReader, countLines };
