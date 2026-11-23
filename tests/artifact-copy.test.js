// EP-25.04: copying artifacts: a new id, the original untouched, derived_from pointing back.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { createOwnershipFixture } = require("./helpers/artifact-ownership-fixture");
const { previewOwnership, copyArtifact } = require("../ui/server/services/artifacts/artifact-reassign.service");
const { importArtifacts } = require("../tools/migrate/artifact-registry-import");

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("copying creates a new artifact and board id and leaves the original byte-identical", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id, file } = f.board("alfa", "mindmap", "Mapa", { assets: true });
    const before = sha(file);
    const copy = copyArtifact(f.ctx, artifact.id, "beta");
    assert.notEqual(copy.id, artifact.id);
    assert.equal(copy.derivedFrom, artifact.id);
    assert.equal(sha(file), before, "the original file did not change");
    assert.equal(f.repo.get(artifact.id).owner, "alfa");

    const created = f.repo.get(copy.id);
    assert.deepEqual([created.owner, created.type, created.title, created.derivedFrom], ["beta", "canvas.mindmap", "Mapa", artifact.id]);
    const [{ path: rel }] = f.repo.filesOf(copy.id);
    const newBoardId = path.basename(rel, ".json");
    assert.notEqual(newBoardId, id, "the board inside gets its own id");
    const written = JSON.parse(fs.readFileSync(path.join(f.dir, rel), "utf8"));
    assert.deepEqual([written.id, written.rev], [newBoardId, 1]);
    assert.ok(f.exists("beta", "canvas", newBoardId, "assets", "a.png"), "assets are copied under the new board id");
    assert.equal(f.repo.history(copy.id)[0].action, "copy");
    assert.deepEqual(f.repo.findReferences(artifact.id).derivatives.map((a) => a.id), [copy.id]);
  } finally { f.cleanup(); }
});

test("a copy can go to the personal workspace or stay in the same project", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact } = f.board("alfa", "board", "Quadro");
    const personal = copyArtifact(f.ctx, artifact.id, "_pessoal");
    const same = copyArtifact(f.ctx, artifact.id, "alfa");
    assert.equal(f.repo.get(personal.id).owner, "_pessoal");
    assert.equal(f.repo.get(same.id).owner, "alfa");
    assert.equal(f.repo.listByOwner("alfa").length, 2);
    assert.ok(f.exists("_pessoal", "instructions.md"));
  } finally { f.cleanup(); }
});

test("a later import does not register the copy twice", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact } = f.board("alfa", "board", "Quadro");
    copyArtifact(f.ctx, artifact.id, "beta");
    assert.equal(importArtifacts(f.repo, f.dir).registered, 0);
    assert.equal(f.repo.listByOwner("beta").length, 1);
  } finally { f.cleanup(); }
});

test("copy preview reports no broken links and does not write", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "board", "Quadro");
    f.board("alfa", "board", "Cita", { extra: { data: { link: id } } });
    const view = previewOwnership(f.ctx, artifact.id, "beta", "copy");
    assert.deepEqual([view.mode, view.brokenReferences.length, view.canProceed], ["copy", 0, true]);
    assert.equal(f.exists("beta", "canvas"), false);
  } finally { f.cleanup(); }
});
