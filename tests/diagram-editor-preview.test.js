// EP-21.04: live preview engine (CP-03). Fakes only: no DOM, no Mermaid, no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const src = (...parts) => pathToFileURL(path.join(__dirname, "../ui/web/src/features", ...parts)).href;
const load = (...parts) => import(src(...parts));

/** Promise with external resolvers, to control the order in which async work finishes. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets pending microtasks run, so every started `run` reaches its next await. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

const OK_VALIDATION = { ok: true, type: "er" };
const RENDER = { svg: "<svg></svg>", width: 10, height: 20 };

// ---------------------------------------------------------------------------
// CP-03: live preview engine
// ---------------------------------------------------------------------------

test("CP-03 preview: a valid source renders and becomes the last good render", async () => {
  const { createPreviewEngine } = await load("diagram", "preview.ts");
  const engine = createPreviewEngine({
    validate: async () => OK_VALIDATION,
    render: async () => RENDER,
  });

  const state = await engine.run("erDiagram\n A ||--o{ B : x");

  assert.deepEqual(state, { status: "ok", render: RENDER });
  assert.deepEqual(engine.lastGood(), RENDER);
});

test("CP-03 preview: a validation error keeps the line and falls back to the previous good render", async () => {
  const { createPreviewEngine } = await load("diagram", "preview.ts");
  let verdict = OK_VALIDATION;
  const engine = createPreviewEngine({
    validate: async () => verdict,
    render: async () => RENDER,
  });

  // First run: broken source, nothing rendered before, so lastGood is null.
  verdict = { ok: false, line: 3, message: "x" };
  const first = await engine.run("broken");
  assert.deepEqual(first, { status: "error", line: 3, message: "x", lastGood: null });

  // Then a valid run, and a broken one after it: lastGood is the previous valid render.
  verdict = OK_VALIDATION;
  await engine.run("valid");
  verdict = { ok: false, line: 3, message: "x" };
  const second = await engine.run("broken again");
  assert.deepEqual(second, { status: "error", line: 3, message: "x", lastGood: RENDER });
});

test("CP-03 preview: an error thrown by render is reported with its line", async () => {
  const { createPreviewEngine } = await load("diagram", "preview.ts");
  const engine = createPreviewEngine({
    validate: async () => OK_VALIDATION,
    render: async () => {
      throw Object.assign(new Error("parse failed"), { line: 4 });
    },
  });

  const state = await engine.run("erDiagram");

  assert.equal(state.status, "error");
  assert.equal(state.line, 4);
  assert.equal(state.message, "parse failed");
  assert.equal(state.lastGood, null);
});

test("CP-03 preview: a slow older run never overwrites a newer one (race)", async () => {
  const { createPreviewEngine } = await load("diagram", "preview.ts");
  const pending = new Map();
  const engine = createPreviewEngine({
    validate: async () => OK_VALIDATION,
    render: (source) => {
      const gate = deferred();
      pending.set(source, gate);
      return gate.promise;
    },
  });

  const oldRun = engine.run("old source");
  const newRun = engine.run("new source");
  await settle();

  const newRender = { svg: "<svg>new</svg>", width: 1, height: 1 };
  const oldRender = { svg: "<svg>old</svg>", width: 2, height: 2 };

  // The newer run finishes first, then the older (stale) one finishes last.
  pending.get("new source").resolve(newRender);
  const newState = await newRun;
  pending.get("old source").resolve(oldRender);
  const oldState = await oldRun;

  assert.equal(oldState, null);
  assert.deepEqual(newState, { status: "ok", render: newRender });
  assert.deepEqual(engine.lastGood(), newRender);
});

test("CP-03 CP-04 preview: reset invalidates runs in flight and forgets the last good render", async () => {
  const { createPreviewEngine } = await load("diagram", "preview.ts");
  const pending = [];
  const engine = createPreviewEngine({
    validate: async () => OK_VALIDATION,
    render: () => {
      const gate = deferred();
      pending.push(gate);
      return gate.promise;
    },
  });

  // Establish a last good render first.
  const warmup = engine.run("warmup");
  await settle();
  pending[0].resolve(RENDER);
  await warmup;
  assert.deepEqual(engine.lastGood(), RENDER);

  // A run in flight when reset happens resolves to null.
  const inFlight = engine.run("in flight");
  await settle();
  engine.reset();
  pending[1].resolve({ svg: "<svg>late</svg>", width: 3, height: 3 });

  assert.equal(await inFlight, null);
  assert.equal(engine.lastGood(), null);
});

