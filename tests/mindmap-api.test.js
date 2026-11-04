// Mind-map REST client (ui/web/src/features/mindmap/api.ts). Node strips types, so the .ts source is imported directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const file = path.join(__dirname, "..", "ui", "web", "src", "features", "mindmap", "api.ts");
const load = () => import(pathToFileURL(file).href);

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Swaps the global fetch for a fake that records the calls, and always restores it. */
async function withFetch(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test("a 409 answer becomes a conflict error that carries the current revision", async () => {
  const { ApiError, createMindmapApi } = await load();
  await withFetch(
    () => json(409, { error: "Revision conflict", code: "CONFLICT", currentRev: 7 }),
    async () => {
      const api = createMindmapApi("demo");
      await assert.rejects(api.save("b1", 3, { schema: "mindmap@1" }), (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.isConflict, true);
        assert.equal(error.status, 409);
        assert.equal(error.code, "CONFLICT");
        assert.equal(error.currentRev, 7);
        assert.equal(error.message, "Revision conflict");
        return true;
      });
    },
  );
});

test("list keeps only kind=mindmap boards and scopes the request to the project", async () => {
  const { createMindmapApi } = await load();
  const boards = [
    { id: "m1", title: "Ideas", kind: "mindmap", rev: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "c1", title: "Canvas", kind: "board", rev: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  await withFetch(
    () => json(200, { boards }),
    async (calls) => {
      const api = createMindmapApi("my project");
      assert.deepEqual(
        (await api.list()).map((board) => board.id),
        ["m1"],
      );
      assert.equal(calls[0].url, "/api/canvas/boards?project=my%20project");
    },
  );
});

test("a non-OK answer becomes an error with status, code and a fallback message", async () => {
  const { ApiError, createMindmapApi } = await load();
  await withFetch(
    () => json(500, { code: "INTERNAL" }),
    async () => {
      const api = createMindmapApi("demo");
      await assert.rejects(api.get("b1"), (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.isConflict, false);
        assert.equal(error.status, 500);
        assert.equal(error.code, "INTERNAL");
        assert.equal(error.message, "Request failed (500)");
        return true;
      });
    },
  );
});
