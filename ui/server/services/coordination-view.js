// @ts-check
// Read-only projection of the coordination ledger (state.json) into lanes for the Scrum board.
// Never writes: the ledger stays the single source for "who works on a story now" (plan 04, advisory only).
const fs = require("fs");
const path = require("path");

/** Ledger statuses in display order. `done` is counted but its cards are not listed. */
const LANE_ORDER = ["claimed", "in_progress", "review", "blocked", "ready", "planned", "done"];
const ACTIVE = new Set(["claimed", "in_progress", "review", "blocked"]);

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
    // The ledger does not record worktrees today; show them only when a story carries one.
    worktree: story.worktree || story.branch || null,
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
