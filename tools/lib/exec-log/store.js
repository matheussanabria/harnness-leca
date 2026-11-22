// @ts-check
"use strict";
// Store of the executive log: docs/executive/log.jsonl, append-only, one JSON object per line.
// It records what a dossier or a commit cannot: decisions, findings, corrections, approvals and pending items that
// happen in conversation. Each entry points to evidence (a file or a commit), so a report never cites a bare claim.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../root");
const { inspectSecrets } = require("../memory/guard");

const KINDS = Object.freeze(["delivery", "decision", "finding", "correction", "risk", "approval", "pending", "metric"]);
const LIMITS = Object.freeze({ title: 120, summary: 700, evidence: 12, evidenceItem: 200, key: 80, metrics: 12 });

const logFile = (root = ROOT) => path.join(root, "docs", "executive", "log.jsonl");
const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD, local time (same rule as daily-journal.js)

/**
 * @typedef {{ id: string, ts: string, date: string, kind: string, epic?: string, story?: string, title: string,
 *   summary: string, evidence: string[], metrics?: Record<string, number>, resolves?: string, key?: string, by: string }} Entry
 */

/** @param {string} file @returns {Entry[]} */
function readEntries(file) {
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  /** @type {Entry[]} */ const out = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try { out.push(JSON.parse(line)); } catch { throw new Error(`log.jsonl line ${index + 1} is not valid JSON`); }
  });
  return out;
}

/** @param {Entry[]} entries */
function nextId(entries) {
  const max = entries.reduce((n, e) => Math.max(n, Number(/^L-(\d+)$/.exec(e.id)?.[1] || 0)), 0);
  return `L-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Checks one entry as typed by the caller (no id or timestamp yet). Returns every problem, not only the first.
 * @param {Record<string, any>} input @param {Entry[]} existing
 */
function validateInput(input, existing = []) {
  /** @type {string[]} */ const errors = [];
  const text = (/** @type {unknown} */ v) => (typeof v === "string" ? v.trim() : "");
  if (!KINDS.includes(input.kind)) errors.push(`kind must be one of: ${KINDS.join(", ")}`);
  const title = text(input.title);
  const summary = text(input.summary);
  if (!title || title.length > LIMITS.title) errors.push(`title is required (up to ${LIMITS.title} characters)`);
  if (!summary || summary.length > LIMITS.summary) errors.push(`summary is required (up to ${LIMITS.summary} characters)`);
  if (input.epic !== undefined && !/^EP-\d+$/.test(input.epic)) errors.push("epic must look like EP-24");
  if (input.story !== undefined && !/^\d+\.\d+$/.test(input.story)) errors.push("story must look like 24.06");
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push("date must be AAAA-MM-DD");
  if (input.by !== undefined && !/^[a-z0-9_-]{1,20}$/.test(input.by)) errors.push("by must be a short lowercase name");
  if (input.key !== undefined && (typeof input.key !== "string" || !input.key || input.key.length > LIMITS.key)) errors.push(`key must be up to ${LIMITS.key} characters`);
  const evidence = input.evidence ?? [];
  if (!Array.isArray(evidence) || evidence.length > LIMITS.evidence || evidence.some((e) => typeof e !== "string" || !e.trim() || e.length > LIMITS.evidenceItem)) {
    errors.push(`evidence must be a list of up to ${LIMITS.evidence} paths, commits or URLs`);
  }
  const metrics = input.metrics;
  if (metrics !== undefined) {
    const keys = metrics && typeof metrics === "object" ? Object.keys(metrics) : [];
    if (!keys.length || keys.length > LIMITS.metrics || keys.some((k) => !/^[a-z][a-z0-9_]*$/.test(k) || !Number.isFinite(metrics[k]))) {
      errors.push(`metrics must be 1 to ${LIMITS.metrics} name=number pairs (lowercase names)`);
    }
  }
  if (input.kind === "metric" && metrics === undefined) errors.push("a metric entry needs metrics");
  if (input.resolves !== undefined && !existing.some((e) => e.id === input.resolves)) errors.push(`resolves points to ${input.resolves}, which does not exist`);
  const secrets = inspectSecrets(title, summary);
  if (secrets.length) errors.push(`the text looks like it holds a secret or personal data (${secrets.join(", ")}); remove it`);
  return errors;
}

/**
 * Appends an entry. A `key` makes the call idempotent: the same key twice returns the first entry untouched.
 * @param {string} file @param {Record<string, any>} input @param {{ now?: () => Date }} [options]
 * @returns {{ entry: Entry, duplicate: boolean }}
 */
function appendEntry(file, input, options = {}) {
  const existing = readEntries(file);
  if (input.key) {
    const same = existing.find((e) => e.key === input.key);
    if (same) return { entry: same, duplicate: true };
  }
  const errors = validateInput(input, existing);
  if (errors.length) throw new Error(errors.join("; "));
  const now = (options.now || (() => new Date()))();
  /** @type {Entry} */
  const entry = {
    id: nextId(existing),
    ts: now.toISOString(),
    date: input.date || now.toLocaleDateString("sv-SE"),
    kind: input.kind,
    ...(input.epic ? { epic: input.epic } : {}),
    ...(input.story ? { story: input.story } : {}),
    title: input.title.trim(),
    summary: input.summary.trim(),
    evidence: (input.evidence ?? []).map((/** @type {string} */ e) => e.trim()),
    ...(input.metrics ? { metrics: input.metrics } : {}),
    ...(input.resolves ? { resolves: input.resolves } : {}),
    ...(input.key ? { key: input.key } : {}),
    by: input.by || "claude",
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  return { entry, duplicate: false };
}

/**
 * Evidence that does not exist: missing files, unknown commits. URLs are not fetched.
 * @param {Entry[]} entries @param {{ pathExists: (p: string) => boolean, commitExists: (h: string) => boolean }} checks
 */
function findBrokenEvidence(entries, checks) {
  /** @type {{ id: string, evidence: string, reason: string }[]} */ const broken = [];
  for (const entry of entries) {
    for (const item of entry.evidence || []) {
      if (/^https?:\/\//.test(item)) continue;
      if (/^[0-9a-f]{7,40}$/.test(item)) {
        if (!checks.commitExists(item)) broken.push({ id: entry.id, evidence: item, reason: "commit not found" });
      } else if (!checks.pathExists(item)) {
        broken.push({ id: entry.id, evidence: item, reason: "file not found" });
      }
    }
  }
  return broken;
}

/** Duplicate ids can appear if two agents append at once; `verify` reports them. @param {Entry[]} entries */
const duplicateIds = (entries) => [...new Set(entries.map((e) => e.id).filter((id, i, all) => all.indexOf(id) !== i))];

/** Pending items and risks that no later entry resolves. @param {Entry[]} entries */
function openItems(entries) {
  const resolved = new Set(entries.map((e) => e.resolves).filter(Boolean));
  return entries.filter((e) => (e.kind === "pending" || e.kind === "risk") && !resolved.has(e.id));
}

module.exports = { KINDS, LIMITS, logFile, today, readEntries, validateInput, appendEntry, findBrokenEvidence, duplicateIds, openItems, nextId };
