// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { CURRENT_VERSION, MIGRATORS, migrateBoard } = require("../ui/server/services/canvas/canvas-migrate");

const board = (extra = {}) => ({
  v: 1, id: crypto.randomUUID(), kind: "board", title: "T", rev: 3,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", data: { n: 1 }, ...extra,
});
const code = (expected) => (error) => error.code === expected;

test("the shipped schema is v1 with no migrators yet", () => {
  assert.equal(CURRENT_VERSION, 1);
  assert.deepEqual(MIGRATORS, {});
});

test("a valid v1 board comes back unchanged with changed=false and from=1", () => {
  const input = board();
  assert.deepEqual(migrateBoard(input), { board: input, from: 1, changed: false });
});

test("a board without v is treated as the current version", () => {
  const { v, ...noVersion } = board();
  const result = migrateBoard(noVersion);
  assert.equal(result.from, 1);
  assert.equal(result.board.v, 1);
  assert.equal(result.changed, false);
});

test("a board from a newer version is refused with UNSUPPORTED_VERSION (422)", () => {
  assert.throws(() => migrateBoard(board({ v: 2 })), (error) => error.code === "UNSUPPORTED_VERSION" && error.status === 422);
});

test("v must be an integer of at least 1", () => {
  for (const v of [0, -1, 1.5, "1", null]) assert.throws(() => migrateBoard(board({ v })), code("INVALID_STORED_BOARD"));
});

test("things that are not boards are rejected", () => {
  const noId = board(); delete noId.id;
  const noKind = board(); delete noKind.kind;
  const cases = [null, undefined, "x", 7, [board()], noId, noKind, board({ id: "../../x" }), board({ kind: "other" }),
    board({ data: "text" }), board({ data: [] }), board({ data: null })];
  for (const bad of cases) assert.throws(() => migrateBoard(bad), code("INVALID_STORED_BOARD"));
});

test("missing optional fields are normalized (rev 1, empty title, epoch timestamps)", () => {
  const { title, rev, createdAt, updatedAt, ...bare } = board();
  const result = migrateBoard(bare).board;
  assert.equal(result.title, "");
  assert.equal(result.rev, 1);
  assert.equal(result.createdAt, new Date(0).toISOString());
  assert.equal(result.updatedAt, new Date(0).toISOString());
});

test("a multi-step chain runs in order, upgrades v1 to v3, and leaves its input untouched", () => {
  const order = [];
  const migrators = {
    1: (b) => { order.push(1); return { ...b, data: { ...b.data, step1: true } }; },
    2: (b) => { order.push(2); return { ...b, data: { ...b.data, step2: true } }; },
  };
  const input = board();
  const snapshot = JSON.parse(JSON.stringify(input));
  const result = migrateBoard(input, migrators, 3);
  assert.deepEqual(order, [1, 2]);
  assert.equal(result.from, 1);
  assert.equal(result.changed, true);
  assert.equal(result.board.v, 3);
  assert.deepEqual(result.board.data, { n: 1, step1: true, step2: true });
  assert.deepEqual(input, snapshot, "the stored object is not mutated");
});

test("a chain starting at a later version only runs the remaining steps", () => {
  const order = [];
  const migrators = { 1: (b) => { order.push(1); return b; }, 2: (b) => { order.push(2); return b; } };
  const result = migrateBoard(board({ v: 2 }), migrators, 3);
  assert.deepEqual(order, [2]);
  assert.equal(result.from, 2);
});

test("a missing migrator in the chain refuses the board instead of guessing", () => {
  assert.throws(() => migrateBoard(board(), { 2: (b) => b }, 3), code("UNSUPPORTED_VERSION"));
});

test("a migrator that returns a non-object is rejected", () => {
  assert.throws(() => migrateBoard(board(), { 1: () => null }, 2), code("INVALID_STORED_BOARD"));
});
