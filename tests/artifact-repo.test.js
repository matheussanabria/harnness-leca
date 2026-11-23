// EP-25.03: artifact registry repository (migration 025) on an in-memory database.
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase } = require("../ui/server/db/connection");
const { createArtifactRepo } = require("../ui/server/db/repos/artifact.repo");
const { newArtifactId, isArtifactId } = require("../ui/server/services/artifacts/artifact-id");

function fixture() {
  const db = createTestDatabase();
  return { db, repo: createArtifactRepo(db) };
}

test("ids are stable-format, unique and time-sortable", () => {
  const a = newArtifactId(1_000_000_000_000);
  const b = newArtifactId(1_000_000_000_001);
  assert.ok(isArtifactId(a) && isArtifactId(b));
  assert.notEqual(a, b);
  assert.ok(a.slice(4, 14) < b.slice(4, 14), "the time prefix sorts by creation time");
  assert.equal(isArtifactId("art_short"), false);
});

test("register stores the artifact, its files and a create entry in the history", () => {
  const { db, repo } = fixture();
  try {
    const { artifact, created } = repo.register({
      type: "canvas.mindmap", owner: "_pessoal", title: "Ideias",
      files: [{ path: "_pessoal/canvas/x.json", contentHash: "abc" }], actor: "web",
    });
    assert.equal(created, true);
    assert.ok(isArtifactId(artifact.id));
    assert.equal(repo.get(artifact.id)?.owner, "_pessoal");
    assert.deepEqual(repo.filesOf(artifact.id), [{ path: "_pessoal/canvas/x.json", contentHash: "abc" }]);
    const history = repo.history(artifact.id);
    assert.equal(history.length, 1);
    assert.deepEqual([history[0].from, history[0].to, history[0].action, history[0].actor], [null, "_pessoal", "create", "web"]);
  } finally {
    db.close();
  }
});

test("registering the same source key twice returns the first artifact and adds nothing", () => {
  const { db, repo } = fixture();
  try {
    const first = repo.register({ type: "canvas.board", owner: "alfa", title: "A", sourceKey: "canvas:alfa:1" });
    const second = repo.register({ type: "canvas.board", owner: "alfa", title: "A (outro)", sourceKey: "canvas:alfa:1" });
    assert.equal(second.created, false);
    assert.equal(second.artifact.id, first.artifact.id);
    assert.equal(repo.listByOwner("alfa").length, 1);
    assert.equal(repo.history(first.artifact.id).length, 1);
  } finally {
    db.close();
  }
});

test("listByOwner filters by owner and type", () => {
  const { db, repo } = fixture();
  try {
    repo.register({ type: "canvas.board", owner: "alfa", title: "1" });
    repo.register({ type: "canvas.mindmap", owner: "alfa", title: "2" });
    repo.register({ type: "canvas.board", owner: "beta", title: "3" });
    assert.equal(repo.listByOwner("alfa").length, 2);
    assert.deepEqual(repo.listByOwner("alfa", { type: "canvas.mindmap" }).map((a) => a.title), ["2"]);
    assert.equal(repo.listByOwner("nobody").length, 0);
  } finally {
    db.close();
  }
});

test("a copy records its origin and findReferences links both directions", () => {
  const { db, repo } = fixture();
  try {
    const original = repo.register({ type: "canvas.board", owner: "alfa", title: "orig" }).artifact;
    const copy = repo.register({ type: "canvas.board", owner: "beta", title: "orig", derivedFrom: original.id }).artifact;
    assert.equal(repo.history(copy.id)[0].action, "copy");
    assert.deepEqual(repo.findReferences(original.id).derivatives.map((a) => a.id), [copy.id]);
    assert.equal(repo.findReferences(copy.id).derivedFrom?.id, original.id);
    assert.equal(repo.findReferences(original.id).derivedFrom, null);
  } finally {
    db.close();
  }
});

test("a failure inside register leaves nothing behind", () => {
  const { db, repo } = fixture();
  try {
    assert.throws(() => repo.register({ type: "x", owner: "alfa", title: "t", derivedFrom: "art_does_not_exist" }));
    assert.equal(repo.listByOwner("alfa").length, 0);
    assert.throws(() => repo.register({ type: "", owner: "alfa", title: "t" }), /required/);
  } finally {
    db.close();
  }
});
