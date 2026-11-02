const test = require("node:test");
const assert = require("node:assert");
const { buildCoordinationView } = require("../ui/server/services/coordination-view");

const NOW = Date.parse("2026-11-02T00:00:00Z");
const state = {
  project: "p",
  revision: 3,
  stories: {
    a: { id: "a", status: "claimed", owner: "x", title: "A", lease: { expiresAt: "2026-11-01T00:00:00Z" } },
    b: { id: "b", status: "claimed", owner: "y", title: "B", lease: { expiresAt: "2026-11-03T00:00:00Z" }, worktree: "wt-b" },
    c: { id: "c", status: "done", owner: "x", title: "C" },
    d: { id: "d", status: "planned", owner: null, title: "D" },
    e: { id: "e", status: "weird", title: "E" },
  },
};

test("groups stories by ledger status and flags expired leases", () => {
  const view = buildCoordinationView(state, NOW);
  const claimed = view.lanes.find((lane) => lane.id === "claimed");
  assert.strictEqual(claimed.count, 2);
  assert.strictEqual(claimed.cards.find((c) => c.id === "a").leaseExpired, true);
  assert.strictEqual(claimed.cards.find((c) => c.id === "b").leaseExpired, false);
  assert.strictEqual(claimed.cards.find((c) => c.id === "b").worktree, "wt-b");
  assert.strictEqual(claimed.cards.find((c) => c.id === "a").worktree, null);
});

test("done lane is counted but lists no cards; unknown status is ignored", () => {
  const view = buildCoordinationView(state, NOW);
  const done = view.lanes.find((lane) => lane.id === "done");
  assert.strictEqual(done.count, 1);
  assert.deepStrictEqual(done.cards, []);
  assert.strictEqual(view.lanes.reduce((n, l) => n + l.count, 0), 4);
  assert.strictEqual(view.activeCount, 2);
});

test("empty ledger yields empty lanes", () => {
  const view = buildCoordinationView(null, NOW);
  assert.strictEqual(view.lanes.every((l) => l.count === 0), true);
});
