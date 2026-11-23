// EP-25.04: moving artifacts between owners, with preview, confirmation, collisions and undo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createOwnershipFixture } = require("./helpers/artifact-ownership-fixture");
const { previewOwnership, reassign, undoReassign } = require("../ui/server/services/artifacts/artifact-reassign.service");
const { importArtifacts } = require("../tools/migrate/artifact-registry-import");
const { readIndex } = require("../ui/server/services/canvas/canvas-index");

const fail = (fn, code) => assert.throws(fn, (e) => e.code === code, `expected ${code}`);

test("moving without confirmado: true is refused and changes nothing", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa");
    fail(() => reassign(f.ctx, artifact.id, "beta"), "CONFIRMATION_REQUIRED");
    fail(() => reassign(f.ctx, artifact.id, "beta", { confirmado: "true" }), "CONFIRMATION_REQUIRED");
    assert.ok(f.exists("alfa", "canvas", `${id}.json`));
    assert.equal(f.repo.get(artifact.id).owner, "alfa");
  } finally { f.cleanup(); }
});

test("preview lists files, links that would break and writes nothing", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa");
    f.board("alfa", "board", "Quadro que cita", { extra: { data: { link: id } } });
    const view = previewOwnership(f.ctx, artifact.id, "beta");
    assert.deepEqual([view.from, view.to, view.mode, view.canProceed], ["alfa", "beta", "move", true]);
    assert.deepEqual(view.files, [`beta/canvas/${id}.json`]);
    assert.equal(view.brokenReferences.length, 1);
    assert.equal(view.brokenReferences[0].title, "Quadro que cita");
    assert.equal(f.exists("beta", "canvas"), false, "preview must not create anything");
    assert.equal(f.repo.history(artifact.id).length, 1);
  } finally { f.cleanup(); }
});

test("a confirmed move relocates the files and assets, updates the registry and rebuilds both indexes", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa", { assets: true });
    const result = reassign(f.ctx, artifact.id, "beta", { confirmado: true });
    assert.deepEqual([result.from, result.to], ["alfa", "beta"]);
    assert.equal(f.exists("alfa", "canvas", `${id}.json`), false);
    assert.equal(f.exists("alfa", "canvas", id), false);
    assert.ok(f.exists("beta", "canvas", `${id}.json`));
    assert.ok(f.exists("beta", "canvas", id, "assets", "a.png"));
    const moved = f.repo.get(artifact.id);
    assert.equal(moved.owner, "beta");
    assert.equal(moved.sourceKey, `canvas:beta:${id}`);
    assert.deepEqual(f.repo.filesOf(artifact.id).map((x) => x.path), [`beta/canvas/${id}.json`]);
    const log = f.repo.history(artifact.id);
    assert.deepEqual([log.at(-1).from, log.at(-1).to, log.at(-1).action], ["alfa", "beta", "move"]);
    assert.equal(readIndex(path.join(f.dir, "beta", "canvas")).some((b) => b.id === id), true);
    assert.equal(readIndex(path.join(f.dir, "alfa", "canvas")).some((b) => b.id === id), false);
  } finally { f.cleanup(); }
});

test("a collision at the destination aborts without touching anything", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "board", "Quadro");
    fs.mkdirSync(path.join(f.dir, "beta", "canvas"), { recursive: true });
    fs.writeFileSync(path.join(f.dir, "beta", "canvas", `${id}.json`), "{}");
    assert.equal(previewOwnership(f.ctx, artifact.id, "beta").canProceed, false);
    fail(() => reassign(f.ctx, artifact.id, "beta", { confirmado: true }), "COLLISION");
    assert.ok(f.exists("alfa", "canvas", `${id}.json`));
    assert.equal(fs.readFileSync(path.join(f.dir, "beta", "canvas", `${id}.json`), "utf8"), "{}", "never overwrites");
    assert.equal(f.repo.get(artifact.id).owner, "alfa");
  } finally { f.cleanup(); }
});

test("same owner, unknown destination, unknown artifact and unsupported type are refused", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact } = f.board("alfa", "board", "Quadro");
    fail(() => reassign(f.ctx, artifact.id, "alfa", { confirmado: true }), "SAME_OWNER");
    fail(() => reassign(f.ctx, artifact.id, "nao-existe", { confirmado: true }), "INVALID_OWNER");
    fail(() => reassign(f.ctx, artifact.id, "_template", { confirmado: true }), "INVALID_OWNER");
    fail(() => reassign(f.ctx, "art_00000000000000000000000000", "beta", { confirmado: true }), "NOT_FOUND");
    const other = f.repo.register({ type: "prototype", owner: "alfa", title: "P" }).artifact;
    fail(() => reassign(f.ctx, other.id, "beta", { confirmado: true }), "UNSUPPORTED_TYPE");
  } finally { f.cleanup(); }
});

test("moving to the personal workspace creates it and a later import does not duplicate the artifact", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Solto");
    reassign(f.ctx, artifact.id, "_pessoal", { confirmado: true });
    assert.ok(f.exists("_pessoal", "canvas", `${id}.json`));
    assert.ok(f.exists("_pessoal", "instructions.md"));
    const totals = importArtifacts(f.repo, f.dir);
    assert.equal(totals.registered, 0, "the moved board is already registered under its new key");
    assert.equal(f.repo.listByOwner("_pessoal").length, 1);
  } finally { f.cleanup(); }
});

test("undo puts the artifact back while nothing changed", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa", { assets: true });
    const { logId } = reassign(f.ctx, artifact.id, "beta", { confirmado: true });
    const back = undoReassign(f.ctx, artifact.id, logId);
    assert.equal(back.to, "alfa");
    assert.ok(f.exists("alfa", "canvas", `${id}.json`));
    assert.ok(f.exists("alfa", "canvas", id, "assets", "a.png"));
    assert.equal(f.exists("beta", "canvas", `${id}.json`), false);
    assert.equal(f.repo.get(artifact.id).sourceKey, `canvas:alfa:${id}`);
    assert.equal(f.repo.lastLog(artifact.id).undoOf, logId);
  } finally { f.cleanup(); }
});

test("undo is refused after the artifact was edited or moved again", () => {
  const f = createOwnershipFixture();
  try {
    const edited = f.board("alfa", "mindmap", "Editado");
    const first = reassign(f.ctx, edited.artifact.id, "beta", { confirmado: true });
    fs.appendFileSync(path.join(f.dir, "beta", "canvas", `${edited.id}.json`), " ");
    fail(() => undoReassign(f.ctx, edited.artifact.id, first.logId), "UNDO_NOT_ALLOWED");

    const twice = f.board("alfa", "board", "Duas vezes");
    const one = reassign(f.ctx, twice.artifact.id, "beta", { confirmado: true });
    reassign(f.ctx, twice.artifact.id, "_pessoal", { confirmado: true });
    fail(() => undoReassign(f.ctx, twice.artifact.id, one.logId), "UNDO_NOT_ALLOWED");
    fail(() => undoReassign(f.ctx, twice.artifact.id, 99999), "UNDO_NOT_ALLOWED");
  } finally { f.cleanup(); }
});
