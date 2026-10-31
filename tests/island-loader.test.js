// @ts-check
// Unit tests for the shared React island loader (ADR-011), using a hand-rolled fake document (no jsdom).
import test from "node:test";
import assert from "node:assert/strict";
import { createIslandLoader } from "../ui/public/js/shared/island-loader.js";

function fakeElement(tag = "div") {
  return {
    tagName: tag,
    id: "",
    className: "",
    hidden: false,
    dataset: {},
    children: [],
    setAttribute(name, value) { this[name] = value; },
    append(...nodes) { for (const node of nodes) this.children.push(node); },
    appendChild(node) { this.children.push(node); return node; },
    replaceChildren() { this.children.length = 0; },
  };
}

/** Minimal Document stand-in: resolves hosts by id only when body adopted them, dedupes CSS links by selector. */
function fakeDoc() {
  const byId = {};
  const links = [];
  const doc = {
    head: { appendChild(node) { links.push(node); return node; } },
    body: { appendChild(node) { if (node.id) byId[node.id] = node; return node; } },
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => fakeElement(tag),
    querySelector(selector) {
      const match = /^link\[data-island-css="(.+)"\]$/.exec(selector);
      if (!match) return null;
      return links.find((link) => link.dataset?.islandCss === match[1]) || null;
    },
  };
  return { doc, links, host: () => byId.islandHost || null };
}

function noticeText(fake) {
  const host = fake.host();
  const box = host?.children.find((child) => child.className === "island-host__notice");
  return box ? box.children.filter((node) => typeof node === "string").join("").trim() : "";
}

function fakeIsland(recorder = {}) {
  return {
    mount(el, props) { recorder.el = el; recorder.props = props; return { unmount: () => { recorder.unmounts += 1; } }; },
    handle: null,
  };
}

test("mount(lab) loads the index then the entry, injects one link per CSS file and mounts on the host", async () => {
  const index = { default: { lab: { file: "lab-abc123.js", css: ["lab.abc.css", "lab2.def.css"] } } };
  const recorder = { unmounts: 0 };
  const island = fakeIsland(recorder);
  const calls = [];
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    now: () => 1729,
    importer: async (url) => {
      calls.push(url);
      return url.includes("islands.js") ? index : island;
    },
  });
  const mounted = await loader.mount("lab", { slug: "proj", params: ["a", "b"] });
  assert.equal(mounted, true, "the island mounted");
  assert.deepEqual(calls, ["/dist/islands.js?t=1729", "/dist/lab-abc123.js"]);
  assert.deepEqual(fake.links.map((link) => link.href), ["/dist/lab.abc.css", "/dist/lab2.def.css"]);
  assert.deepEqual(fake.links.map((link) => link.dataset.islandCss), ["/dist/lab.abc.css", "/dist/lab2.def.css"]);
  assert.equal(recorder.el.id, "islandHost");
  assert.deepEqual(recorder.props, { slug: "proj", params: ["a", "b"] });
  assert.equal(loader.activeName(), "lab");
});

test("mounting the same island twice does not duplicate its CSS links", async () => {
  const index = { default: { lab: { file: "lab-abc123.js", css: ["lab.abc.css"] } } };
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    importer: async (url) => (url.includes("islands.js") ? index : fakeIsland()),
  });
  await loader.mount("lab", { slug: "proj", params: [] });
  await loader.mount("lab", { slug: "proj", params: [] });
  assert.equal(fake.links.length, 1, "the existing link must be reused through querySelector");
});

test("unmount closes the island once, clears the host and hides it", async () => {
  const index = { default: { lab: { file: "lab-abc123.js", css: [] } } };
  const recorder = { unmounts: 0 };
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    now: () => 1,
    importer: async (url) => {
      if (url.includes("islands.js")) return index;
      return { mount(el) { el.appendChild(fakeElement("div")); return fakeIsland(recorder).mount(el, {}); } };
    },
  });
  await loader.mount("lab", { slug: "proj", params: [] });
  assert.equal(fake.host().children.length, 1, "the island content is on the host");
  loader.unmount();
  assert.equal(recorder.unmounts, 1);
  assert.equal(fake.host().children.length, 0, "the host was cleared");
  assert.equal(fake.host().hidden, true);
  assert.equal(loader.activeName(), null);
});

test("when islands.js cannot be imported, mount fails with a build notice", async () => {
  const fake = fakeDoc();
  const loader = createIslandLoader({ doc: fake.doc, importer: async () => { throw new Error("no build"); } });
  const mounted = await loader.mount("lab", { slug: "proj", params: [] });
  assert.equal(mounted, false);
  assert.match(noticeText(fake), /npm run build:web/);
  assert.equal(loader.activeName(), null);
});

test("when the build index lacks the island, mount fails with a missing entry notice", async () => {
  const calls = [];
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    importer: async (url) => {
      calls.push(url);
      return { default: {} };
    },
  });
  const mounted = await loader.mount("lab", { slug: "proj", params: [] });
  assert.equal(mounted, false);
  assert.equal(calls.length, 1, "only the index is fetched");
  assert.match(noticeText(fake), /missing from the build/);
  assert.equal(loader.activeName(), null);
});

test("an unknown island name fails without touching the importer", async () => {
  const calls = [];
  const fake = fakeDoc();
  const loader = createIslandLoader({ doc: fake.doc, importer: async (url) => { calls.push(url); return {}; } });
  const mounted = await loader.mount("no-such-island", { slug: "proj", params: [] });
  assert.equal(mounted, false);
  assert.equal(calls.length, 0);
  assert.match(noticeText(fake), /Unknown island: no-such-island/);
  assert.equal(loader.activeName(), null);
});

test("an island handle whose unmount throws does not break navigation", async () => {
  const index = { default: { lab: { file: "lab-abc123.js", css: [] } } };
  const broken = { unmount() { throw new Error("boom"); } };
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    now: () => 1,
    importer: async (url) => (url.includes("islands.js") ? index : { mount: () => broken }),
  });
  await loader.mount("lab", { slug: "proj", params: [] });
  assert.doesNotThrow(() => loader.unmount(), "a broken unmount must be swallowed");
  assert.equal(loader.activeName(), null);
  assert.equal(fake.host().hidden, true);
});

test("leaving the route while the island is still loading never mounts it into the hidden host", async () => {
  const index = { default: { lab: { file: "lab-abc123.js", css: [] } } };
  const recorder = { unmounts: 0 };
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fake = fakeDoc();
  const loader = createIslandLoader({
    doc: fake.doc,
    now: () => 1,
    importer: async (url) => {
      if (url.includes("islands.js")) return index;
      await gate;
      return fakeIsland(recorder);
    },
  });
  const pending = loader.mount("lab", { slug: "proj", params: [] });
  await new Promise((resolve) => setImmediate(resolve));
  loader.unmount();
  release();
  assert.equal(await pending, false, "the stale mount reports that it did not mount");
  assert.equal(recorder.el, undefined, "the island module was never mounted");
  assert.equal(loader.activeName(), null);
  assert.equal(fake.host().hidden, true, "the host stays hidden after leaving");
});
