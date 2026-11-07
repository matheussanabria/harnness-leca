const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (name) => import(pathToFileURL(path.join(__dirname, "../ui/web/src/features/board", name)).href);
const HASH = "a".repeat(64);
const PNG_URL = `data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString("base64")}`;

test("sanitizeAppState keeps the allowlist and drops volatile keys and bad values", async () => {
  const { sanitizeAppState } = await load("sanitize.ts");
  const out = sanitizeAppState({
    viewBackgroundColor: "#fff",
    gridSize: null,
    currentItemOpacity: 80,
    collaborators: new Map([["a", {}]]),
    selectedElementIds: { x: true },
    scrollX: 10,
    currentItemFontSize: Number.NaN,
    currentItemStrokeColor: { evil: 1 },
  });
  assert.deepEqual(out, { viewBackgroundColor: "#fff", gridSize: null, currentItemOpacity: 80 });
  assert.deepEqual(sanitizeAppState(null), {});
  assert.deepEqual(sanitizeAppState([1]), {});
});

test("serializeScene drops deleted elements and unused file refs, and strips appState", async () => {
  const { serializeScene } = await load("serialize.ts");
  const manifest = {
    keep: { ref: `${HASH}.png`, mimeType: "image/png", created: 1 },
    gone: { ref: `${"b".repeat(64)}.png`, mimeType: "image/png", created: 2 },
  };
  const data = serializeScene(
    [
      { id: "1", type: "image", fileId: "keep" },
      { id: "2", type: "image", fileId: "gone", isDeleted: true },
      { id: "3", type: "rectangle", isDeleted: true },
    ],
    { viewBackgroundColor: "#000", collaborators: {} },
    manifest,
  );
  assert.equal(data.schema, "excalidraw@1");
  assert.deepEqual(data.elements.map((e) => e.id), ["1"]);
  assert.deepEqual(Object.keys(data.files), ["keep"]);
  assert.deepEqual(data.appState, { viewBackgroundColor: "#000" });
  assert.ok(!JSON.stringify(data).includes("base64"));
});

test("deserializeScene round-trips, accepts new empty boards and refuses foreign schemas", async () => {
  const { serializeScene, deserializeScene, UnsupportedBoardError } = await load("serialize.ts");
  const manifest = { f: { ref: `${HASH}.png`, mimeType: "image/png", created: 5 } };
  const data = serializeScene([{ id: "1", type: "image", fileId: "f" }], { gridSize: 20 }, manifest);
  assert.deepEqual(deserializeScene(JSON.parse(JSON.stringify(data))), {
    elements: data.elements,
    appState: { gridSize: 20 },
    files: manifest,
  });
  assert.deepEqual(deserializeScene({}), { elements: [], appState: {}, files: {} });
  assert.throws(() => deserializeScene({ schema: "mindmap@1" }), UnsupportedBoardError);
  assert.throws(() => deserializeScene(null), UnsupportedBoardError);
});

test("deserializeScene drops malformed elements, refs and path-like asset names", async () => {
  const { deserializeScene } = await load("serialize.ts");
  const scene = deserializeScene({
    schema: "excalidraw@1",
    elements: [{ id: "ok", type: "line" }, { type: "x" }, null, { id: "", type: "t" }],
    appState: { collaborators: 1, gridSize: 10 },
    files: {
      good: { ref: `${HASH}.webp`, mimeType: "image/webp", created: 1 },
      evil: { ref: "../../secret.png", mimeType: "image/png", created: 1 },
      typed: { ref: `${HASH}.png`, mimeType: "text/html", created: 1 },
    },
  });
  assert.deepEqual(scene.elements.map((e) => e.id), ["ok"]);
  assert.deepEqual(Object.keys(scene.files), ["good"]);
  assert.deepEqual(scene.appState, { gridSize: 10 });
});

test("assertWithinLimit rejects payloads above the cap", async () => {
  const { assertWithinLimit, BoardTooLargeError, MAX_DATA_BYTES } = await load("serialize.ts");
  assert.ok(assertWithinLimit({ a: "x" }) > 0);
  assert.throws(() => assertWithinLimit({ a: "x".repeat(MAX_DATA_BYTES) }), BoardTooLargeError);
});

test("planUploads uploads new supported images and flags SVG as unsupported", async () => {
  const { planUploads, decodeDataUrl, referencedFileIds } = await load("assetRefs.ts");
  const elements = [
    { id: "1", type: "image", fileId: "new" },
    { id: "2", type: "image", fileId: "svg" },
    { id: "3", type: "image", fileId: "done" },
    { id: "4", type: "image", fileId: "unloaded" },
    { id: "5", type: "image", fileId: "dead", isDeleted: true },
  ];
  const files = {
    new: { id: "new", mimeType: "image/png", dataURL: PNG_URL, created: 1 },
    svg: { id: "svg", mimeType: "image/svg+xml", dataURL: "data:image/svg+xml;base64,AAAA", created: 1 },
    done: { id: "done", mimeType: "image/png", dataURL: PNG_URL, created: 1 },
    dead: { id: "dead", mimeType: "image/png", dataURL: PNG_URL, created: 1 },
  };
  const manifest = { done: { ref: `${HASH}.png`, mimeType: "image/png", created: 1 } };
  assert.deepEqual(planUploads(elements, files, manifest), { upload: ["new"], unsupported: ["svg"] });
  assert.equal(referencedFileIds(elements).has("dead"), false);
  assert.deepEqual([...decodeDataUrl(PNG_URL).bytes], [137, 80, 78, 71]);
  assert.equal(decodeDataUrl("data:text/html,<b>"), null);
  assert.equal(decodeDataUrl("javascript:alert(1)"), null);
});

function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    setTimer: (fn) => {
      pending.set(next, fn);
      return next++;
    },
    clearTimer: (h) => pending.delete(h),
    fire: () => {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) fn();
    },
    size: () => pending.size,
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("autosave debounces bursts into one save and reports dirty, saving, saved", async () => {
  const { createAutosave } = await load("autosave.ts");
  const timers = fakeTimers();
  const states = [];
  let saves = 0;
  const auto = createAutosave({
    delayMs: 800,
    ...timers,
    save: async () => {
      saves += 1;
    },
    isConflict: () => false,
    onState: (s) => states.push(s),
  });
  auto.touch();
  auto.touch();
  auto.touch();
  assert.equal(timers.size(), 1);
  timers.fire();
  await settle();
  assert.equal(saves, 1);
  assert.deepEqual(states, ["dirty", "dirty", "dirty", "saving", "saved"]);
});

test("autosave saves again when a change arrives during a save", async () => {
  const { createAutosave } = await load("autosave.ts");
  const timers = fakeTimers();
  let release;
  let saves = 0;
  const auto = createAutosave({
    delayMs: 1,
    ...timers,
    isConflict: () => false,
    onState: () => {},
    save: () => {
      saves += 1;
      return saves === 1
        ? new Promise((r) => {
            release = r;
          })
        : Promise.resolve();
    },
  });
  auto.touch();
  timers.fire();
  await settle();
  assert.equal(auto.state(), "saving");
  auto.touch();
  release();
  await settle();
  timers.fire();
  await auto.flush();
  assert.equal(saves, 2);
  assert.equal(auto.state(), "saved");
});

test("autosave stops on conflict until resume, and keeps working after other errors", async () => {
  const { createAutosave } = await load("autosave.ts");
  const timers = fakeTimers();
  let mode = "conflict";
  let saves = 0;
  const auto = createAutosave({
    delayMs: 1,
    ...timers,
    onState: () => {},
    isConflict: (e) => e.conflict === true,
    save: async () => {
      saves += 1;
      if (mode === "conflict") throw { conflict: true };
      if (mode === "fail") throw new Error("x");
    },
  });
  auto.touch();
  timers.fire();
  await settle();
  assert.equal(auto.state(), "conflict");
  auto.touch();
  assert.equal(timers.size(), 0, "no timer while in conflict");
  await auto.flush();
  assert.equal(saves, 1);
  auto.resume();
  assert.equal(auto.state(), "idle");
  mode = "fail";
  auto.touch();
  timers.fire();
  await settle();
  assert.equal(auto.state(), "error");
  mode = "ok";
  auto.touch();
  timers.fire();
  await settle();
  assert.equal(auto.state(), "saved");
});

test("autosave dispose cancels the pending timer", async () => {
  const { createAutosave } = await load("autosave.ts");
  const timers = fakeTimers();
  const auto = createAutosave({
    delayMs: 1,
    ...timers,
    save: async () => {},
    isConflict: () => false,
    onState: () => {},
  });
  auto.touch();
  auto.dispose();
  assert.equal(timers.size(), 0);
});

function fakeApi() {
  const calls = [];
  return {
    calls,
    uploadAsset: async (id, bytes, name) => {
      calls.push(["upload", id, name, bytes.length]);
      return { hash: HASH, ext: "png" };
    },
    update: async (id, patch) => {
      calls.push(["update", id, patch.rev, patch.data]);
      return { rev: patch.rev + 1 };
    },
    assetUrl: (id, file) => `/a/${id}/${file}`,
  };
}

test("session uploads new images once, stores refs only, and advances rev", async () => {
  const { createBoardSession } = await load("session.ts");
  const api = fakeApi();
  const session = createBoardSession(api, "b1", { rev: 3, manifest: {} });
  const snap = {
    elements: [{ id: "1", type: "image", fileId: "f1" }],
    appState: { collaborators: {} },
    files: { f1: { id: "f1", mimeType: "image/png", dataURL: PNG_URL, created: 9 } },
  };
  await session.save(snap);
  await session.save(snap);
  assert.equal(api.calls.filter((c) => c[0] === "upload").length, 1);
  assert.deepEqual(api.calls[0], ["upload", "b1", "f1.png", 4]);
  const updates = api.calls.filter((c) => c[0] === "update");
  assert.deepEqual(updates.map((c) => c[2]), [3, 4]);
  assert.equal(updates[0][3].files.f1.ref, `${HASH}.png`);
  assert.ok(!JSON.stringify(updates[0][3]).includes("data:image"));
  assert.equal(session.rev(), 5);
});

test("session reports unsupported files and keeps rev when the update fails", async () => {
  const { createBoardSession } = await load("session.ts");
  const api = fakeApi();
  api.update = async () => {
    throw new Error("409");
  };
  const session = createBoardSession(api, "b1", { rev: 1, manifest: {} });
  const snap = {
    elements: [{ id: "1", type: "image", fileId: "s" }],
    appState: {},
    files: { s: { id: "s", mimeType: "image/svg+xml", dataURL: "data:image/svg+xml;base64,AAAA", created: 1 } },
  };
  await assert.rejects(session.save(snap));
  assert.equal(session.rev(), 1);
  assert.equal(api.calls.length, 0);
});

test("session rasterizes SVG images to PNG before upload and reports failed conversions", async () => {
  const { createBoardSession } = await load("session.ts");
  const api = fakeApi();
  const seen = [];
  const rasterize = async (url) => {
    seen.push(url);
    if (url.includes("BAD")) throw new Error("tainted");
    return PNG_URL;
  };
  const session = createBoardSession(api, "b1", { rev: 1, manifest: {} }, rasterize);
  const svg = (payload) => ({ mimeType: "image/svg+xml", dataURL: `data:image/svg+xml;base64,${payload}`, created: 2 });
  const snap = {
    elements: [
      { id: "1", type: "image", fileId: "ok" },
      { id: "2", type: "image", fileId: "bad" },
    ],
    appState: {},
    files: { ok: { id: "ok", ...svg("AAAA") }, bad: { id: "bad", ...svg("BAD0") } },
  };
  const first = await session.save(snap);
  assert.deepEqual(first.unsupported, ["bad"]);
  assert.deepEqual(api.calls[0], ["upload", "b1", "ok.png", 4]);
  const update = api.calls.find((c) => c[0] === "update");
  assert.deepEqual(update[3].files.ok, { ref: `${HASH}.png`, mimeType: "image/png", created: 2 });
  assert.equal(update[3].files.bad, undefined);
  await session.save(snap);
  assert.equal(api.calls.filter((c) => c[0] === "upload").length, 1, "an uploaded SVG is not converted again");
  assert.equal(seen.filter((url) => url.includes("AAAA")).length, 1);
});

test("rehydrateFiles rebuilds data URLs and lists missing assets", async () => {
  const { rehydrateFiles } = await load("session.ts");
  const api = fakeApi();
  const manifest = {
    ok: { ref: `${HASH}.png`, mimeType: "image/png", created: 7 },
    bad: { ref: `${"c".repeat(64)}.png`, mimeType: "image/png", created: 8 },
  };
  const fetchImpl = async (url) =>
    url.includes(HASH)
      ? { ok: true, blob: async () => new Blob(["x"]) }
      : { ok: false, blob: async () => new Blob([]) };
  const { files, missing } = await rehydrateFiles(api, "b1", manifest, async () => "data:image/png;base64,eA==", fetchImpl);
  assert.deepEqual(Object.keys(files), ["ok"]);
  assert.equal(files.ok.created, 7);
  assert.deepEqual(missing, ["bad"]);
});

function response(status, body) {
  return { ok: status < 400, status, json: async () => body, blob: async () => new Blob([]) };
}

test("board api builds requests, filters kind, and exposes 409 conflicts", async () => {
  const { createBoardApi, BoardApiError } = await load("api.ts");
  const seen = [];
  const replies = [
    response(200, { boards: [{ id: "1", kind: "board" }, { id: "2", kind: "mindmap" }] }),
    response(201, { board: { id: "3", rev: 1 } }),
    response(409, { error: "stale", code: "REVISION_CONFLICT", currentRev: 7 }),
    response(200, { asset: { hash: HASH, ext: "png" } }),
    response(500, null),
  ];
  const api = createBoardApi("my proj", async (url, init) => {
    seen.push([url, init]);
    return replies.shift();
  });
  assert.deepEqual((await api.list()).map((b) => b.id), ["1"]);
  assert.equal(seen[0][0], "/api/canvas/boards?project=my%20proj");
  await api.create("T");
  assert.deepEqual(JSON.parse(seen[1][1].body), { kind: "board", title: "T" });
  await assert.rejects(
    api.update("id/1", { rev: 1, data: {} }),
    (e) => e instanceof BoardApiError && e.isConflict && e.currentRev === 7,
  );
  assert.equal(seen[2][0], "/api/canvas/boards/id%2F1?project=my%20proj");
  assert.equal(seen[2][1].method, "PUT");
  await api.uploadAsset("b", new Uint8Array([1]), "a b.png");
  assert.equal(seen[3][0], "/api/canvas/boards/b/assets?project=my%20proj&name=a%20b.png");
  await assert.rejects(api.get("x"), (e) => e.status === 500 && e.code === "HTTP_ERROR");
  assert.equal(api.assetUrl("b", `${HASH}.png`), `/api/canvas/boards/b/assets/${HASH}.png?project=my%20proj`);
});

test("exportFileName makes safe download names", async () => {
  const { exportFileName } = await load("exportName.ts");
  assert.equal(exportFileName("My Board: v2/final", "png"), "My-Board-v2final.png");
  assert.equal(exportFileName("../..", "svg"), "board.svg");
  assert.equal(exportFileName("   ", "svg"), "board.svg");
});
