// EP-25.04: a failure in the middle of a move or copy leaves the artifact entirely at the origin.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { createOwnershipFixture } = require("./helpers/artifact-ownership-fixture");
const { reassign, copyArtifact } = require("../ui/server/services/artifacts/artifact-reassign.service");
const { applyOps } = require("../ui/server/services/artifacts/artifact-fs-ops");

/** A fs whose Nth call of `method` throws, to simulate a failure halfway through. */
function flakyFs(method, failOn) {
  let calls = 0;
  return new Proxy(fs, {
    get(target, prop) {
      if (prop !== method) return target[prop];
      return (...args) => {
        calls += 1;
        if (calls === failOn) throw new Error("simulated disk failure");
        return target[prop](...args);
      };
    },
  });
}

test("a failure on the second file operation puts the first one back", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa", { assets: true });
    const ctx = { ...f.ctx, fsx: flakyFs("renameSync", 2) };
    assert.throws(() => reassign(ctx, artifact.id, "beta", { confirmado: true }), (e) => e.code === "STORAGE");
    assert.ok(f.exists("alfa", "canvas", `${id}.json`), "the board file is back at the origin");
    assert.ok(f.exists("alfa", "canvas", id, "assets", "a.png"));
    assert.equal(f.exists("beta", "canvas", `${id}.json`), false);
    assert.equal(f.repo.get(artifact.id).owner, "alfa");
    assert.equal(f.repo.history(artifact.id).length, 1, "no ownership entry was written");
  } finally { f.cleanup(); }
});

test("a database failure after the files moved puts the files back", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact, id } = f.board("alfa", "board", "Quadro", { assets: true });
    const repo = Object.assign({}, f.repo, { setOwner() { throw new Error("database down"); } });
    assert.throws(() => reassign({ ...f.ctx, repo }, artifact.id, "beta", { confirmado: true }), /database down/);
    assert.ok(f.exists("alfa", "canvas", `${id}.json`));
    assert.ok(f.exists("alfa", "canvas", id, "assets", "a.png"));
    assert.equal(f.exists("beta", "canvas", `${id}.json`), false);
    assert.equal(f.repo.get(artifact.id).owner, "alfa");
  } finally { f.cleanup(); }
});

test("a copy that fails halfway leaves no partial copy and no registry row", () => {
  const f = createOwnershipFixture();
  try {
    const { artifact } = f.board("alfa", "mindmap", "Mapa", { assets: true });
    const ctx = { ...f.ctx, fsx: flakyFs("cpSync", 1) };
    assert.throws(() => copyArtifact(ctx, artifact.id, "beta"), (e) => e.code === "STORAGE");
    assert.equal(fs.existsSync(`${f.dir}/beta/canvas`) ? fs.readdirSync(`${f.dir}/beta/canvas`).length : 0, 0);
    assert.equal(f.repo.listByOwner("beta").length, 0);
    assert.equal(f.repo.findReferences(artifact.id).derivatives.length, 0);
  } finally { f.cleanup(); }
});

test("applyOps refuses to overwrite and reverts what it already did", () => {
  const f = createOwnershipFixture();
  try {
    const a = `${f.dir}/alfa/one.txt`;
    const b = `${f.dir}/alfa/two.txt`;
    fs.writeFileSync(a, "1");
    fs.writeFileSync(b, "2");
    fs.writeFileSync(`${f.dir}/beta/two.txt`, "already here");
    const ops = [{ kind: "move", from: a, to: `${f.dir}/beta/one.txt` }, { kind: "move", from: b, to: `${f.dir}/beta/two.txt` }];
    assert.throws(() => applyOps(ops), (e) => e.code === "COLLISION");
    assert.ok(fs.existsSync(a), "the first move was reverted");
    assert.equal(fs.readFileSync(`${f.dir}/beta/two.txt`, "utf8"), "already here");
  } finally { f.cleanup(); }
});
