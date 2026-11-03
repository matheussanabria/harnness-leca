// @ts-check
// Read-only projection of the coordination ledger (state.json) into lanes for the Scrum board.
// Never writes: the ledger stays the single source for "who works on a story now" (plan 04, advisory only).
const fs = require("fs");
const path = require("path");

/** Ledger statuses in display order. `done` is counted but its cards are not listed. */
const LANE_ORDER = ["claimed", "in_progress", "review", "blocked", "ready", "planned", "done"];
const ACTIVE = new Set(["claimed", "in_progress", "review", "blocked"]);

/**
 * `claim --worktree` stores `{ dir, branch }`; older or hand-made entries may hold a plain string.
 * Only the branch name (or the last folder of the path) is exposed: no absolute paths reach the UI.
 * @param {any} value
 * @returns {string|null}
 */
function worktreeLabel(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value.branch) return String(value.branch);
  if (value.dir) return String(value.dir).split(/[\\/]/).filter(Boolean).pop() || null;
  return null;
}

/**
 * @param {any} story
 * @param {number} now
 */
function toCard(story, now) {
  const expiresAt = story.lease?.expiresAt || null;
  return {
    id: story.id,
    epic: story.epic || null,
    title: story.title || "",
    owner: story.owner || null,
    status: story.status,
    leaseExpiresAt: expiresAt,
    leaseExpired: Boolean(expiresAt) && Date.parse(expiresAt) < now,
    worktree: worktreeLabel(story.worktree),
    updatedAt: story.updatedAt || null,
  };
}

/**
 * @param {any} state ledger content
 * @param {number} [now]
 */
function buildCoordinationView(state, now = Date.now()) {
  const stories = Object.values(state?.stories || {});
  const lanes = LANE_ORDER.map((id) => ({ id, count: 0, cards: /** @type {any[]} */ ([]) }));
  const byId = new Map(lanes.map((lane) => [lane.id, lane]));
  for (const story of stories) {
    const lane = byId.get(story.status);
    if (!lane) continue;
    lane.count += 1;
    if (story.status !== "done") lane.cards.push(toCard(story, now));
  }
  return {
    project: state?.project || null,
    revision: state?.revision ?? null,
    updatedAt: state?.updatedAt || null,
    activeCount: stories.filter((item) => ACTIVE.has(item.status)).length,
    lanes,
  };
}

/**
 * @param {string} projectsDir
 * @param {string} slug
 * @returns {any|null} null when the project has no ledger yet
 */
function readLedger(projectsDir, slug) {
  const file = path.join(projectsDir, slug, "coordination", "state.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

module.exports = { buildCoordinationView, readLedger, LANE_ORDER };
