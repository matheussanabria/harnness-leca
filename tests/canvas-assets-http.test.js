// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-canvas-assets-"));
const PROJECTS = path.join(ROOT, "projects");
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
process.env.HARNESS_PROJECTS_DIR = PROJECTS;
fs.mkdirSync(path.join(PROJECTS, SLUG), { recursive: true });

const { canvasRoutes } = require("../ui/server/routes/canvas.routes");
const { fakeRes, fakeReqBinary, fakeReqPaced, fakeReqRaw, json, assertNoPath, png, pdf, txt, svg } = require("./helpers/canvas-http-fake");

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function urlFor(project = SLUG, extra = "") {
  const query = project === null ? "" : `project=${encodeURIComponent(project)}`;
  return new URL(`http://127.0.0.1/api?${query}${extra}`);
}

function findRoute(method, routePath) {
  return canvasRoutes.find((route) => {
    if (route.method !== method) return false;
    return typeof route.path === "string" ? route.path === routePath : route.path.test(routePath);
  });
}

async function invoke(method, routePath, options = {}) {
  const route = findRoute(method, routePath);
  assert.ok(route, `rota ${method} ${routePath} deve existir`);
  const match = typeof route.path === "string" ? null : routePath.match(route.path);
  const params = match ? match.slice(1) : [];
  const res = fakeRes();
  const url = options.url !== undefined ? options.url : urlFor(options.queryProject !== undefined ? options.queryProject : SLUG);
  await route.handler({ req: options.req, res, params, url });
  return res;
}

async function createBoard(title = "Board Test") {
  const body = JSON.stringify({ project: SLUG, kind: "board", title });
  const res = await invoke("POST", "/api/canvas/boards", { req: fakeReqRaw(body) });
  assert.equal(res.status, 201);
  return json(res).board.id;
}

test("canvas-assets-http: upload PNG creates asset with 201, re-upload returns 200", async () => {
  const boardId = await createBoard("Board PNG");
  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    req: fakeReqBinary(png),
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=photo.png`),
  });
  assert.equal(res.status, 201);
  const body = json(res);
  assert.ok(body.asset);
  assert.ok(body.asset.hash);
  assert.equal(body.asset.ext, "png");
  assert.equal(body.asset.mime, "image/png");
  assert.equal(body.asset.inline, true);
  assert.ok(body.asset.url);

  // Re-upload same bytes -> 200
  const res2 = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    req: fakeReqBinary(png),
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=photo.png`),
  });
  assert.equal(res2.status, 200);
});

test("canvas-assets-http: GET asset returns correct headers and content", async () => {
  const boardId = await createBoard("Board GET");
  const uploadRes = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=test.png`),
    req: fakeReqBinary(png),
  });
  const asset = json(uploadRes).asset;
  const urlPath = `/api/canvas/boards/${boardId}/assets/${asset.hash}.png`;

  const getRes = await invoke("GET", urlPath, {
    url: new URL(`http://127.0.0.1${urlPath}?project=${SLUG}`),
  });
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.length, png.length);
  assert.equal(getRes.getHeaders()["Content-Type"], "image/png");
  assert.equal(getRes.getHeaders()["X-Content-Type-Options"], "nosniff");
  assert.equal(getRes.getHeaders()["Content-Security-Policy"], "default-src 'none'; sandbox");
  assert.equal(getRes.getHeaders()["Cache-Control"], "private, max-age=31536000, immutable");
  assert.equal(getRes.getHeaders()["Content-Disposition"], "inline");
});

test("canvas-assets-http: PDF upload served as attachment with correct mime", async () => {
  const boardId = await createBoard("Board PDF");
  const uploadRes = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=doc.pdf`),
    req: fakeReqBinary(pdf),
  });
  const asset = json(uploadRes).asset;
  const urlPath = `/api/canvas/boards/${boardId}/assets/${asset.hash}.pdf`;

  const getRes = await invoke("GET", urlPath, {
    url: new URL(`http://127.0.0.1${urlPath}?project=${SLUG}`),
  });
  assert.equal(getRes.status, 200);
  assert.equal(getRes.getHeaders()["Content-Type"], "application/pdf");
  assert.ok(getRes.getHeaders()["Content-Disposition"].startsWith("attachment"));
  assert.ok(getRes.getHeaders()["Content-Disposition"].includes(".pdf"));
});

test("canvas-assets-http: TXT upload served as attachment with charset", async () => {
  const boardId = await createBoard("Board TXT");
  const uploadRes = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=notes.txt`),
    req: fakeReqBinary(txt),
  });
  const asset = json(uploadRes).asset;
  const urlPath = `/api/canvas/boards/${boardId}/assets/${asset.hash}.txt`;

  const getRes = await invoke("GET", urlPath, {
    url: new URL(`http://127.0.0.1${urlPath}?project=${SLUG}`),
  });
  assert.equal(getRes.status, 200);
  const ct = getRes.getHeaders()["Content-Type"];
  assert.ok(ct.startsWith("text/plain"));
  assert.ok(ct.includes("charset=utf-8"));
  assert.ok(getRes.getHeaders()["Content-Disposition"].startsWith("attachment"));
});

test("canvas-assets-http: SVG upload returns 415 UNSUPPORTED_ASSET_TYPE", async () => {
  const boardId = await createBoard("Board SVG");
  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=image.svg`),
    req: fakeReqBinary(svg),
  });
  assert.equal(res.status, 415);
  const body = json(res);
  assert.equal(body.code, "UNSUPPORTED_ASSET_TYPE");
  assertNoPath(res);
});

test("canvas-assets-http: empty body returns 400 EMPTY_ASSET", async () => {
  const boardId = await createBoard("Board Empty");
  const empty = Buffer.alloc(0);
  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=empty.bin`),
    req: fakeReqBinary(empty),
  });
  assert.equal(res.status, 400);
  const body = json(res);
  assert.equal(body.code, "EMPTY_ASSET");
  assertNoPath(res);
});

test("canvas-assets-http: declared content-length over 25MB returns 413 without consuming stream", async () => {
  const boardId = await createBoard("Board Large");
  const tiny = Buffer.from("tiny");
  const stream = Readable.from(tiny);
  stream.headers = { "content-length": String(25 * 1024 * 1024 + 1) };

  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=big.file`),
    req: stream,
  });
  assert.equal(res.status, 413);
  const body = json(res);
  assert.equal(body.code, "ASSET_TOO_LARGE");
  assert.equal(stream.readableDidRead, false, "the body was never read");
  assertNoPath(res);
});

test("canvas-assets-http: stream over 25MB without content-length returns 413", async () => {
  const boardId = await createBoard("Board Stream");
  // 8 chunks of 8 MiB: the 25 MiB limit is crossed on the 4th, so reading must stop long before the 8th.
  const req = fakeReqPaced(8 * 1024 * 1024, 8);
  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?project=${SLUG}&name=stream.file`),
    req,
  });
  assert.equal(res.status, 413);
  const body = json(res);
  assert.equal(body.code, "ASSET_TOO_LARGE");
  assert.ok(req.produced() <= 6, `reading stopped early (pulled ${req.produced()} of 8 chunks)`);
  assertNoPath(res);
});

test("canvas-assets-http: upload to unknown board returns 404 BOARD_NOT_FOUND", async () => {
  const unknownId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
  const req = fakeReqBinary(png);
  const res = await invoke("POST", `/api/canvas/boards/${unknownId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${unknownId}/assets?project=${SLUG}&name=test.png`),
    req,
  });
  assert.equal(res.status, 404);
  assert.equal(req.readableDidRead, false, "the body is not read for an unknown board");
  const body = json(res);
  assert.equal(body.code, "BOARD_NOT_FOUND");
  assertNoPath(res);
});

test("canvas-assets-http: upload without project returns 400 PROJECT_REQUIRED", async () => {
  const boardId = await createBoard("Board No Project");
  const res = await invoke("POST", `/api/canvas/boards/${boardId}/assets`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets?name=test.png`),
    req: fakeReqBinary(png),
  });
  assert.equal(res.status, 400);
  const body = json(res);
  assert.equal(body.code, "PROJECT_REQUIRED");
  assertNoPath(res);
});

test("canvas-assets-http: GET malformed file returns 400 INVALID_ASSET", async () => {
  const boardId = await createBoard("Board Malformed");
  const badHash = "not-a-hash";
  const res = await invoke("GET", `/api/canvas/boards/${boardId}/assets/${badHash}.png`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets/${badHash}.png?project=${SLUG}`),
  });
  assert.equal(res.status, 400);
  const body = json(res);
  assert.equal(body.code, "INVALID_ASSET");
  assertNoPath(res);
});

test("canvas-assets-http: GET uppercase hash returns 400 INVALID_ASSET", async () => {
  const boardId = await createBoard("Board Upper");
  const res = await invoke("GET", `/api/canvas/boards/${boardId}/assets/ABCD1234567890ABCDEF.png`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets/ABCD1234567890ABCDEF.png?project=${SLUG}`),
  });
  assert.equal(res.status, 400);
  const body = json(res);
  assert.equal(body.code, "INVALID_ASSET");
  assertNoPath(res);
});

test("canvas-assets-http: GET .svg name returns 400 INVALID_ASSET", async () => {
  const boardId = await createBoard("Board SVG Name");
  const validHash = "a".repeat(64);
  const res = await invoke("GET", `/api/canvas/boards/${boardId}/assets/${validHash}.svg`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets/${validHash}.svg?project=${SLUG}`),
  });
  assert.equal(res.status, 400);
  const body = json(res);
  assert.equal(body.code, "INVALID_ASSET");
  assertNoPath(res);
});

test("canvas-assets-http: GET never stored hash returns 404 ASSET_NOT_FOUND", async () => {
  const boardId = await createBoard("Board Missing");
  const neverStored = "b".repeat(64);
  const res = await invoke("GET", `/api/canvas/boards/${boardId}/assets/${neverStored}.png`, {
    url: new URL(`http://127.0.0.1/api/canvas/boards/${boardId}/assets/${neverStored}.png?project=${SLUG}`),
  });
  assert.equal(res.status, 404);
  const body = json(res);
  assert.equal(body.code, "ASSET_NOT_FOUND");
  assertNoPath(res);
});

test("canvas-assets-http: route precedence - upload route vs board item route", () => {
  const assetCollection = findRoute("POST", "/api/canvas/boards/abc/assets");
  assert.ok(assetCollection);
  assert.equal(assetCollection.handler.name, "apiCanvasAssetUpload");

  const boardItem = findRoute("GET", "/api/canvas/boards/abc/assets");
  assert.equal(boardItem, undefined);
});

test("canvas-assets-http: route precedence - asset GET route vs board item route", () => {
  const assetItem = findRoute("GET", "/api/canvas/boards/abc/assets/abc123.png");
  assert.ok(assetItem);
  assert.equal(assetItem.handler.name, "apiCanvasAssetGet");

  // The path without a file extension still matches the asset route (the hash captures abc123)
  // The important thing is it does NOT match the board item route which has a different pattern
  const boardItem = findRoute("GET", "/api/canvas/boards/abc/assets");
  assert.equal(boardItem, undefined);
});