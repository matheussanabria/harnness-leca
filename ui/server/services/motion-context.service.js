// @ts-check
"use strict";
/**
 * Compact summary of the prototype's timelines for the agent prompt (EP-24.04): one header per screen and one line
 * per track, capped at about 200 tokens, plus a content hash so the agent can tell when a timeline changed.
 * Pure over the inputs; `readMotionFiles` is the small disk adapter.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_TOKENS = 200;
const CHARS_PER_TOKEN = 4;
// Room kept for the closing "omitted" line (about 100 characters).
const OMITTED_LINE_TOKENS = 28;

/** Rough token estimate, same rule as the proto map budget. @param {string} text */
const estimateTokens = (text) => Math.ceil(text.length / CHARS_PER_TOKEN);

/** @param {any} track */
function trackLine(track) {
  const keys = Array.isArray(track?.keys) ? track.keys : [];
  const props = [...new Set(keys.flatMap((/** @type {any} */ k) => Object.keys(k?.props || {})))].join(",");
  const times = keys.map((/** @type {any} */ k) => Number(k?.t)).filter(Number.isFinite);
  const span = times.length ? `${Math.min(...times)}-${Math.max(...times)}ms` : "sem keys";
  return `- ${track?.target}: ${props || "sem props"} ${span}`;
}

/**
 * @param {{ screen: string, doc: any, text: string }[]} timelines
 * @param {{ maxTokens?: number }} [options]
 * @returns {{ text: string, hash: string, omitted: number }}
 */
function buildMotionSummary(timelines, options = {}) {
  const maxTokens = options.maxTokens || MAX_TOKENS;
  if (!timelines.length) return { text: "", hash: "", omitted: 0 };
  const hash = crypto.createHash("sha256").update(timelines.map((t) => `${t.screen}\n${t.text}`).join("\n")).digest("hex").slice(0, 12);
  const lines = [`## Timelines de motion (hash ${hash})`];
  let omitted = 0;
  for (const { screen, doc } of timelines) {
    const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
    const header = `${screen}: ${doc?.duration} ms, ${doc?.fps} fps${doc?.loop ? ", loop" : ""}, ${tracks.length} faixa(s)`;
    if (estimateTokens([...lines, header].join("\n")) > maxTokens - OMITTED_LINE_TOKENS) {
      omitted += tracks.length;
      continue;
    }
    lines.push(header);
    for (const track of tracks) {
      const line = trackLine(track);
      if (estimateTokens([...lines, line].join("\n")) > maxTokens - OMITTED_LINE_TOKENS) omitted += 1;
      else lines.push(line);
    }
  }
  if (omitted) lines.push(`(${omitted} faixa(s) omitidas por tamanho; leia o arquivo screens/<tela>.motion.json se precisar)`);
  return { text: lines.join("\n"), hash, omitted };
}

/**
 * Reads screens/*.motion.json of a prototype; unreadable files are skipped.
 * @param {string} protoDir
 * @returns {{ screen: string, doc: any, text: string }[]}
 */
function readMotionFiles(protoDir) {
  const dir = path.join(protoDir, "screens");
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".motion.json")).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      out.push({ screen: file.replace(/\.motion\.json$/, ""), doc: JSON.parse(text), text });
    } catch { /* corrupt timeline: the store reports it when the agent touches it */ }
  }
  return out;
}

/** @param {string} protoDir @returns {string} prompt block, or "" when the prototype has no timeline */
function buildMotionContext(protoDir) {
  return buildMotionSummary(readMotionFiles(protoDir)).text;
}

module.exports = { buildMotionSummary, buildMotionContext, readMotionFiles, estimateTokens, MAX_TOKENS };
