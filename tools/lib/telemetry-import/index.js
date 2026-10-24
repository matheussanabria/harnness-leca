// @ts-check
// Idempotent legacy telemetry importer (T1.4, ADR-TEL-004/006). Reads the legacy JSONL files
// read-only and writes events through ingestEvent. Dry-run (default) never touches the store.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { parseLine } = require("./common");
const { mapHiaRecord, HIA_FILE } = require("./map-hia");
const { mapRuntimeRecord, RUNTIME_FILE } = require("./map-runtime");

const MAPPERS = { [HIA_FILE]: mapHiaRecord, [RUNTIME_FILE]: mapRuntimeRecord };
const MAX_INVALID_SAMPLES = 10;

/** @returns {string[]} default legacy files under the harness root */
function defaultFiles() {
  return [HIA_FILE, RUNTIME_FILE].map((name) => path.join(ROOT, "logs", "telemetry", name));
}

/**
 * Keys already present in the project store (dry-run only; no store is created).
 * @param {string} slug
 * @returns {Set<string>}
 */
function existingKeys(slug) {
  const keys = new Set();
  const { DB_REL, readEvents } = require("../../../ui/server/services/events/event-store");
  if (!fs.existsSync(path.join(ROOT, "projects", slug, DB_REL))) return keys;
  let cursor = "0";
  for (;;) {
    const page = readEvents(slug, { cursor, limit: 1000, types: ["usage.observed", "run.finished"] });
    if (!page.events.length) break;
    for (const event of page.events) {
      if (event.idempotencyKey) keys.add(`${event.source.provider}:${event.idempotencyKey}`);
    }
    cursor = page.cursor;
  }
  return keys;
}

/**
 * @param {string} file
 * @param {{ slug: string, apply: boolean, known: Set<string> }} ctx
 */
function importFile(file, ctx) {
  const name = path.basename(file);
  const stats = { file, read: 0, imported: 0, duplicate: 0, invalid: 0, flagged: 0, invalidSamples: /** @type {any[]} */ ([]) };
  const mapper = /** @type {Record<string, Function>} */ (MAPPERS)[name];
  if (!mapper) {
    return { ...stats, error: `unsupported file name '${name}' (expected ${HIA_FILE} or ${RUNTIME_FILE})` };
  }
  if (!fs.existsSync(file)) return { ...stats, error: "file not found" };
  const { ingestEvent } = require("../../../ui/server/services/events/event-ingest");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    stats.read += 1;
    const reject = (/** @type {string} */ reason) => {
      stats.invalid += 1;
      if (stats.invalidSamples.length < MAX_INVALID_SAMPLES) stats.invalidSamples.push({ line: index + 1, reason });
    };
    const parsed = parseLine(line);
    if (!parsed.ok) return reject(parsed.reason);
    const mapped = mapper(parsed.record, line);
    if (!mapped.ok) return reject(mapped.reason);
    if (mapped.flags.length) stats.flagged += 1;
    const key = `${mapped.input.source.provider}:${mapped.input.idempotencyKey}`;
    if (!ctx.apply) {
      if (ctx.known.has(key)) stats.duplicate += 1;
      else {
        ctx.known.add(key);
        stats.imported += 1;
      }
      return;
    }
    try {
      const result = ingestEvent(ctx.slug, mapped.input);
      if (result.duplicated) stats.duplicate += 1;
      else stats.imported += 1;
    } catch (err) {
      if (mapped.flags.length) stats.flagged -= 1;
      reject(`ingest_rejected:${err && /** @type {any} */ (err).code ? /** @type {any} */ (err).code : "error"}`);
    }
  });
  return stats;
}

/**
 * @param {{ slug: string, apply?: boolean, files?: string[] }} options
 * @returns {{ slug: string, mode: "apply" | "dry-run", files: any[] }}
 */
function importLegacyTelemetry(options) {
  const apply = Boolean(options.apply);
  const files = options.files && options.files.length ? options.files : defaultFiles();
  const known = apply ? new Set() : existingKeys(options.slug);
  const results = files.map((file) => importFile(path.resolve(file), { slug: options.slug, apply, known }));
  return { slug: options.slug, mode: apply ? "apply" : "dry-run", files: results };
}

module.exports = { importLegacyTelemetry, importFile, defaultFiles };
