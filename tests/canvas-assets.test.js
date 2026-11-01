// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

// Setup temporary workspace
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-assets-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });

const store = require("../ui/server/services/canvas/canvas-store");
const assets = require("../ui/server/services/canvas/canvas-assets");
const { MAX_ASSET_BYTES } = require("../ui/server/services/canvas/canvas-asset-types");

const canvasDir = () => path.join(PROJECTS, SLUG, "canvas");
const CREATE = (title, extra = {}) => store.createBoard(SLUG, { kind: "board", title, ...extra });

const expectError = (fn, code, status, check) => {
  assert.throws(fn, e => {
    assert.equal(e.name, "CanvasError");
    assert.equal(e.code, code);
    assert.equal(e.status, status);
    if (check) check(e);
    return true;
  });
};

const png = Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  Buffer.from("payload")
]);
const png2 = Buffer.concat([
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  Buffer.from("payload2")
]);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

const assetFile = (hash, ext) => `${hash}.${ext}`;

// Tests

test("saveAsset returns created true and correct asset metadata", () => {
  const board = CREATE("Test Board");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  const result = assets.saveAsset(SLUG, board.id, png, "image.png");
  assert.equal(result.created, true);
  assert.equal(result.asset.hash, hash);
  assert.equal(result.asset.ext, "png");
  assert.equal(result.asset.size, png.length);
  assert.equal(result.asset.mime, "image/png");
  assert.equal(result.asset.inline, true);
  assert.equal(result.asset.name, "image.png");
  const expectedUrl = `/api/canvas/boards/${board.id}/assets/${hash}.png?project=${encodeURIComponent(SLUG)}`;
  assert.equal(result.asset.url, expectedUrl);
  const filePath = path.join(canvasDir(), board.id, "assets", assetFile(hash, "png"));
  assert.ok(fs.existsSync(filePath));
  assert.deepEqual(fs.readFileSync(filePath), png);
});

test("saving same bytes again returns created false and no duplicate file", () => {
  const board = CREATE("Board 2");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  assets.saveAsset(SLUG, board.id, png, "image.png");
  const result = assets.saveAsset(SLUG, board.id, png, "other.png");
  assert.equal(result.created, false);
  const assetsDir = path.join(canvasDir(), board.id, "assets");
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith(".png"));
  assert.equal(files.length, 1);
});

test("different payloads create distinct files", () => {
  const board = CREATE("Board 3");
  const h1 = crypto.createHash("sha256").update(png).digest("hex");
  const h2 = crypto.createHash("sha256").update(png2).digest("hex");
  assets.saveAsset(SLUG, board.id, png, "image.png");
  const result = assets.saveAsset(SLUG, board.id, png2, "image2.png");
  assert.equal(result.created, true);
  const assetsDir = path.join(canvasDir(), board.id, "assets");
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith(".png"));
  assert.equal(files.length, 2);
  assert.ok(files.includes(assetFile(h1, "png")));
  assert.ok(files.includes(assetFile(h2, "png")));
});

test("hostile names do not affect file location", () => {
  const board = CREATE("Board 4");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  const result = assets.saveAsset(SLUG, board.id, png, "../../../etc/passwd");
  assert.equal(result.created, true);
  const filePath = path.join(canvasDir(), board.id, "assets", assetFile(hash, "png"));
  assert.ok(fs.existsSync(filePath));
  assert.deepEqual(fs.readFileSync(filePath), png);
});

test("SVG bytes throw UNSUPPORTED_ASSET_TYPE", () => {
  const board = CREATE("Board 5");
  expectError(() => assets.saveAsset(SLUG, board.id, svg, "image.svg"), "UNSUPPORTED_ASSET_TYPE", 415);
});

test("empty buffer throws EMPTY_ASSET", () => {
  const board = CREATE("Board 6");
  expectError(() => assets.saveAsset(SLUG, board.id, Buffer.alloc(0), "empty.png"), "EMPTY_ASSET", 400);
});

test("buffer > 25MB throws ASSET_TOO_LARGE", () => {
  const board = CREATE("Board 7");
  const big = Buffer.alloc(MAX_ASSET_BYTES + 1);
  expectError(() => assets.saveAsset(SLUG, board.id, big, "big.png"), "ASSET_TOO_LARGE", 413);
});

test("unknown board uuid throws BOARD_NOT_FOUND", () => {
  const board = CREATE("Board 8");
  const badId = crypto.randomUUID();
  expectError(() => assets.saveAsset(SLUG, badId, png, "image.png"), "BOARD_NOT_FOUND", 404);
});

test("unknown project throws PROJECT_NOT_FOUND", () => {
  expectError(() => assets.saveAsset("unknown-project", crypto.randomUUID(), png, "image.png"), "PROJECT_NOT_FOUND", 404);
});

test("readAsset returns correct metadata", () => {
  const board = CREATE("Board 9");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  const fileName = assetFile(hash, "png");
  assets.saveAsset(SLUG, board.id, png, "image.png");
  const meta = assets.readAsset(SLUG, board.id, fileName);
  const filePath = path.join(canvasDir(), board.id, "assets", fileName);
  assert.equal(meta.path, filePath);
  assert.equal(meta.size, png.length);
  assert.equal(meta.ext, "png");
  assert.equal(meta.mime, "image/png");
  assert.equal(meta.inline, true);
  assert.equal(meta.hash, hash);
});

test("readAsset invalid cases", () => {
  const board = CREATE("Board 10");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  const fileName = assetFile(hash, "png");
  assets.saveAsset(SLUG, board.id, png, "image.png");
  // Invalid path
  expectError(() => assets.readAsset(SLUG, board.id, "../x.png"), "INVALID_ASSET", 400);
  // Path separator
  expectError(() => assets.readAsset(SLUG, board.id, "x/../a.png"), "INVALID_ASSET", 400);
  // Uppercase hex
  const upper = hash.toUpperCase();
  expectError(() => assets.readAsset(SLUG, board.id, `${upper}.png`), "INVALID_ASSET", 400);
  // Non-string
  expectError(() => assets.readAsset(SLUG, board.id, 123), "INVALID_ASSET", 400);
  // Asset not found
  const notFound = 'a'.repeat(64) + '.png';
  expectError(() => assets.readAsset(SLUG, board.id, notFound), "ASSET_NOT_FOUND", 404);
});

test("quota enforcement", () => {
  const board = CREATE("Board 11");
  // Create distinct 20MB chunks (under 25MB limit), add 11 of them to exceed 200MB
  const makeChunk = (i) => Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    // Add unique bytes so each has different hash
    Buffer.from(`chunk${i}`.padEnd(20 * 1024 * 1024 - 8, '\0'))
  ]);
  // Save 10 files = 200MB (exactly at limit)
  for (let i = 0; i < 10; i++) {
    const chunk = makeChunk(i);
    const res = assets.saveAsset(SLUG, board.id, chunk, `chunk${i}.png`);
    assert.equal(res.created, true, `chunk ${i} should be created`);
  }
  // Try to add 11th file - should fail with BOARD_ASSETS_FULL
  const chunk11 = makeChunk(11);
  let caughtError = null;
  try {
    assets.saveAsset(SLUG, board.id, chunk11, "chunk11.png");
  } catch (e) {
    caughtError = e;
  }
  assert.ok(caughtError !== null, "Expected error for 11th unique file");
  assert.equal(caughtError.code, "BOARD_ASSETS_FULL");
  // But saving existing bytes again should succeed via dedup
  const chunk0 = makeChunk(0);
  const result2 = assets.saveAsset(SLUG, board.id, chunk0, "chunk0_dup.png");
  assert.equal(result2.created, false);
});

test("symlink guard rejects when assets folder is symlink", () => {
  const board = CREATE("Board 12");
  const boardDir = path.join(canvasDir(), board.id);
  const assetsDir = path.join(boardDir, "assets");
  // First remove the assets folder created by saveAsset if any
  if (fs.existsSync(assetsDir)) {
    fs.rmSync(assetsDir, { recursive: true, force: true });
  }
  // Ensure boardDir exists (it should, but just in case)
  if (!fs.existsSync(boardDir)) {
    fs.mkdirSync(boardDir, { recursive: true });
  }
  // Use a unique target per test run to avoid conflicts
  const symlinkTarget = path.join(ROOT, "outside-target-symlink-" + board.id.slice(0, 8));
  try {
    fs.mkdirSync(symlinkTarget, { recursive: true });
    fs.symlinkSync(symlinkTarget, assetsDir, "dir");
    // Now assetsDir is a symlink - saveAsset should fail
    let caughtError = null;
    try {
      assets.saveAsset(SLUG, board.id, png, "image.png");
    } catch (e) {
      caughtError = e;
    }
    assert.ok(caughtError !== null);
    assert.equal(caughtError.code, "STORAGE_ERROR");
    assert.equal(caughtError.status, 500);
    assert.ok(!caughtError.message.includes(symlinkTarget));
    // readAsset should also fail
    const hash = crypto.createHash("sha256").update(png).digest("hex");
    let readError = null;
    try {
      assets.readAsset(SLUG, board.id, assetFile(hash, "png"));
    } catch (e) {
      readError = e;
    }
    assert.ok(readError !== null);
    assert.equal(readError.code, "STORAGE_ERROR");
    assert.ok(!readError.message.includes(symlinkTarget));
  } catch (e) {
    if (e.code === 'EPERM') {
      // Skip test if cannot create symlink (admin restricted)
      return;
    }
    throw e;
  }
});

test("deleteBoard moves assets to trash", () => {
  const board = CREATE("Board 13");
  const hash = crypto.createHash("sha256").update(png).digest("hex");
  assets.saveAsset(SLUG, board.id, png, "image.png");
  const res = store.deleteBoard(SLUG, board.id);
  assert.deepEqual(res, { ok: true, id: board.id });
  // Board file gone
  const boardFile = path.join(canvasDir(), `${board.id}.json`);
  assert.ok(!fs.existsSync(boardFile));
  // Trash contains board json
  const trashFiles = fs.readdirSync(path.join(canvasDir(), ".trash"));
  const boardJson = trashFiles.find(f => f.startsWith(board.id) && f.endsWith('.json'));
  assert.ok(boardJson);
  // Trash contains assets folder
  const assetsDirTrash = trashFiles.find(f => f.startsWith(board.id) && f.endsWith('-assets'));
  assert.ok(assetsDirTrash);
  // Original board dir removed
  assert.ok(!fs.existsSync(path.join(canvasDir(), board.id)));
  // List boards no longer includes it
  const list = store.listBoards(SLUG);
  assert.ok(!list.boards.some(b => b.id === board.id));
});

test("deleteBoard works with no assets", () => {
  const board = CREATE("Board 14");
  const res = store.deleteBoard(SLUG, board.id);
  assert.deepEqual(res, { ok: true, id: board.id });
  const boardFile = path.join(canvasDir(), `${board.id}.json`);
  assert.ok(!fs.existsSync(boardFile));
  const list = store.listBoards(SLUG);
  assert.ok(!list.boards.some(b => b.id === board.id));
});

test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));