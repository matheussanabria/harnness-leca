// Shared fixture for the ownership tests (EP-25.04): a temp projects dir with two projects, an in-memory
// registry database and helpers to create registered Canvas boards.
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createTestDatabase } = require("../../ui/server/db/connection");
const { createArtifactRepo } = require("../../ui/server/db/repos/artifact.repo");
const { canvasRegistration } = require("../../ui/server/services/artifacts/artifact-canvas");

function createOwnershipFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-ownership-"));
  for (const slug of ["alfa", "beta"]) fs.mkdirSync(path.join(dir, slug), { recursive: true });
  process.env.HARNESS_PROJECTS_DIR = dir;
  const db = createTestDatabase();
  const repo = createArtifactRepo(db);
  const ctx = { repo, projectsDir: dir, actor: "test" };

  /** Writes a board file (and optional assets) and registers it. Returns the artifact and board id. */
  function board(owner, kind, title, { assets = false, extra = {} } = {}) {
    const id = crypto.randomUUID();
    const canvas = path.join(dir, owner, "canvas");
    fs.mkdirSync(canvas, { recursive: true });
    const file = path.join(canvas, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify({ v: 1, id, kind, title, rev: 3, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", data: {}, ...extra }));
    if (assets) {
      fs.mkdirSync(path.join(canvas, id, "assets"), { recursive: true });
      fs.writeFileSync(path.join(canvas, id, "assets", "a.png"), "binary");
    }
    const input = canvasRegistration(owner, JSON.parse(fs.readFileSync(file, "utf8")), file);
    const artifact = repo.register({ ...input, actor: "test" }).artifact;
    return { artifact, id, file };
  }

  const exists = (...parts) => fs.existsSync(path.join(dir, ...parts));
  const cleanup = () => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { dir, db, repo, ctx, board, exists, cleanup };
}

module.exports = { createOwnershipFixture };
