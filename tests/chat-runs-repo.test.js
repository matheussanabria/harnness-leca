// EP-23.02: chat run journal repository (migration 011) on an in-memory database.
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase } = require("../ui/server/db/connection");
const { createChatRunsRepo } = require("../ui/server/db/repos/chat-runs.repo");

function fixture() {
  const db = createTestDatabase();
  return { db, repo: createChatRunsRepo(db) };
}

test("writes events and reads them back from a seq", () => {
  const { db, repo } = fixture();
  try {
    repo.startRun({ runId: "r1", project: "p", engine: "claude" });
    repo.appendEvents("r1", [0, 1, 2, 3].map((seq) => ({ type: "text", text: `t${seq}`, seq })));
    assert.deepEqual(repo.readFrom("r1", 2).map((e) => e.text), ["t2", "t3"]);
    assert.equal(repo.readFrom("r1").length, 4);
    const run = repo.getRun("r1");
    assert.equal(run.status, "running");
    assert.equal(run.lastSeq, 3);
    assert.equal(run.project, "p");
    assert.equal(run.chatId, null);
  } finally {
    db.close();
  }
});

test("appendEvents is idempotent by run_id + seq", () => {
  const { db, repo } = fixture();
  try {
    repo.startRun({ runId: "r1" });
    assert.equal(repo.appendEvents("r1", [{ type: "text", text: "a", seq: 0 }]), 1);
    assert.equal(repo.appendEvents("r1", [{ type: "text", text: "changed", seq: 0 }, { type: "text", text: "b", seq: 1 }]), 1);
    assert.deepEqual(repo.readFrom("r1").map((e) => e.text), ["a", "b"]);
    repo.startRun({ runId: "r1", project: "other" });
    assert.equal(repo.getRun("r1").project, null, "a second startRun is ignored");
  } finally {
    db.close();
  }
});

test("endRun keeps the first final status and hasTerminalEvent sees done or error", () => {
  const { db, repo } = fixture();
  try {
    repo.startRun({ runId: "r1" });
    repo.appendEvents("r1", [{ type: "text", seq: 0 }]);
    assert.equal(repo.hasTerminalEvent("r1"), false);
    repo.appendEvents("r1", [{ type: "done", seq: 1 }]);
    assert.equal(repo.hasTerminalEvent("r1"), true);
    repo.endRun("r1", "completed");
    repo.endRun("r1", "stopped");
    assert.equal(repo.getRun("r1").status, "completed");
    assert.ok(repo.getRun("r1").endedAt);
  } finally {
    db.close();
  }
});

test("boot marks running runs as interrupted and leaves finished ones alone", () => {
  const { db, repo } = fixture();
  try {
    repo.startRun({ runId: "live" });
    repo.startRun({ runId: "done" });
    repo.endRun("done", "completed");
    assert.equal(repo.markInterruptedOnBoot(), 1);
    assert.equal(repo.getRun("live").status, "interrupted");
    assert.equal(repo.getRun("done").status, "completed");
    assert.equal(repo.markInterruptedOnBoot(), 0);
  } finally {
    db.close();
  }
});

test("prune deletes old finished runs with their events, never running ones", () => {
  const { db, repo } = fixture();
  try {
    repo.startRun({ runId: "old" });
    repo.appendEvents("old", [{ type: "text", seq: 0 }]);
    repo.endRun("old", "completed", "2026-01-01T00:00:00.000Z");
    repo.startRun({ runId: "recent" });
    repo.endRun("recent", "completed", "2026-11-19T00:00:00.000Z");
    repo.startRun({ runId: "live" });
    assert.equal(repo.prune("2026-10-01T00:00:00.000Z"), 1);
    assert.equal(repo.getRun("old"), null);
    assert.equal(repo.readFrom("old").length, 0);
    assert.ok(repo.getRun("recent"));
    assert.ok(repo.getRun("live"));
  } finally {
    db.close();
  }
});
