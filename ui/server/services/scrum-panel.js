// @ts-check
// Read-only projection for the office panel: open stories, who holds them (coordination ledger) and their last commit.
const MAX_STORIES = 60;
const MAX_LEDGER = 30;
const ACTIVE = new Set(["claimed", "in_progress", "review", "blocked"]);

/** @param {any[]} lanes @returns {Map<string, any>} ledger cards by lower-cased story id */
function ledgerIndex(lanes) {
  const map = new Map();
  for (const lane of lanes || []) for (const card of lane.cards || []) map.set(String(card.id).toLowerCase(), { ...card, ledgerStatus: lane.id });
  return map;
}

/**
 * @param {{stories:any[], ledgerLanes:any[], commits:any[], laneOrder:string[]}} input
 */
function buildScrumPanel({ stories, ledgerLanes, commits, laneOrder }) {
  const ledger = ledgerIndex(ledgerLanes);
  const rank = (/** @type {string} */ id) => { const i = laneOrder.indexOf(id); return i < 0 ? 0 : i; };
  const open = stories.filter((s) => s.laneId !== "concluido");
  const items = open.slice(0, MAX_STORIES).map((story) => {
    const keys = [story.id, story.key].filter(Boolean).map((k) => String(k).toLowerCase());
    const held = keys.map((k) => ledger.get(k)).find(Boolean) || null;
    const mine = commits.filter((c) => (c.storyIds || []).some((id) => keys.includes(String(id).toLowerCase())));
    const last = mine[0] || null;
    return {
      id: story.id, key: story.key || null, title: story.title || "", laneId: story.laneId, maturity: story.maturity || "ready",
      epicId: story.epicId || null, impediment: Boolean(story.impediment?.active),
      owner: held?.owner || null, ledgerStatus: held?.ledgerStatus || null, leaseExpired: Boolean(held?.leaseExpired), worktree: held?.worktree || null,
      commitCount: mine.length,
      lastCommit: last ? { shortSha: last.shortSha, subject: last.subject, committedAt: last.committedAt, verified: Boolean(last.verified) } : null,
    };
  }).sort((a, b) => rank(b.laneId) - rank(a.laneId));
  const matched = new Set();
  for (const story of open) for (const k of [story.id, story.key]) if (k) matched.add(String(k).toLowerCase());
  const ledgerActive = [...ledger.values()]
    .filter((card) => ACTIVE.has(card.ledgerStatus) && !matched.has(String(card.id).toLowerCase()))
    .slice(0, MAX_LEDGER)
    .map((card) => ({ id: card.id, title: card.title || "", owner: card.owner || null, status: card.ledgerStatus, leaseExpired: Boolean(card.leaseExpired), worktree: card.worktree || null }));
  const owners = {};
  for (const item of items) if (item.owner) owners[item.owner] = (owners[item.owner] || 0) + 1;
  for (const card of ledgerActive) if (card.owner) owners[card.owner] = (owners[card.owner] || 0) + 1;
  return { total: open.length, shown: items.length, truncated: open.length > items.length, owners, items, ledgerActive };
}

module.exports = { buildScrumPanel, MAX_STORIES };
