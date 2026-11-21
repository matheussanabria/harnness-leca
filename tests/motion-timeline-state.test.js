// @ts-check
// EP-24.06: pure rules of the keyframe panel (snap, neighbors, add/remove, values, ease, labels).
const test = require("node:test");
const assert = require("node:assert/strict");

const mod = import("../ui/public/js/modules/motion-timeline-state.js");

const doc = () => ({
  schema: "motion@1", duration: 1800, fps: 30,
  tracks: [
    { target: "p-2", keys: [{ t: 0, props: { opacity: 0 } }, { t: 500, props: { opacity: 1 }, ease: "ease-out" }, { t: 1000, props: { opacity: 0.5 } }] },
    { target: "p-4", keys: [{ t: 300, props: { opacity: 0, transform: "translateY(24px)" } }, { t: 900, props: { opacity: 1 } }] },
  ],
});

test("CP-21: dragging to 47 ms at 30 fps snaps to 33 ms, the nearest frame", async () => {
  const { snapTime } = await mod;
  const d = doc();
  assert.equal(snapTime(d, 1, 0, 47, { pxPerMs: 0 }), 33);
  assert.equal(snapTime(d, 1, 0, 47, { pxPerMs: 0.5 }), 33);
  assert.equal(snapTime(d, 1, 0, 47, { free: true, pxPerMs: 0.5 }), 47, "Shift drags without snapping");
});

test("CP-22: a key never passes its neighbors; it stops one frame before them", async () => {
  const { snapTime } = await mod;
  const d = doc();
  assert.equal(snapTime(d, 0, 1, 1200, { pxPerMs: 0.5 }), 966, "stops at the frame before 1000 ms");
  assert.equal(snapTime(d, 0, 1, -50, { pxPerMs: 0.5 }), 34, "and after 0 ms");
  assert.equal(snapTime(d, 0, 2, 5000, { pxPerMs: 0.5 }), 1800, "the last key stops at the duration");
  assert.equal(snapTime(d, 0, 1, 1200, { free: true }), 999, "free mode keeps 1 ms of distance");
});

test("motion-timeline: snaps to another track's key within 4 px, and pxPerMs 0 never snaps to keys (arrow-key bug)", async () => {
  const { snapTime } = await mod;
  const d = doc();
  assert.equal(snapTime(d, 1, 0, 495, { pxPerMs: 0.5 }), 500, "5 ms at 0.5 px/ms is 2.5 px: snaps to the key at 500");
  assert.equal(snapTime(d, 1, 0, 480, { pxPerMs: 0.5 }), 467, "20 ms is 10 px: only the frame grid");
  assert.equal(snapTime(d, 1, 0, 333, { pxPerMs: 0 }), 333, "no width known: frame grid only, never the first key");
});

test("motion-timeline: move, add (carrying values), remove (last key stays) without mutating the input", async () => {
  const { moveKey, addKeyAt, removeKey } = await mod;
  const d = doc();
  const moved = moveKey(d, 1, 0, 333);
  assert.equal(moved.tracks[1].keys[0].t, 333);
  assert.equal(d.tracks[1].keys[0].t, 300, "input untouched");
  const added = addKeyAt(d, 1, 600);
  assert.equal(added?.index, 1);
  assert.deepEqual(added?.doc.tracks[1].keys[1], { t: 600, props: { opacity: 0, transform: "translateY(24px)" } });
  assert.deepEqual(addKeyAt(d, 1, 100)?.doc.tracks[1].keys[0].props, { opacity: 0, transform: "translateY(24px)" }, "before the first key: takes the next one");
  assert.equal(addKeyAt(d, 1, 300), null, "a key already exists there");
  assert.equal(removeKey(d, 1, 0)?.tracks[1].keys.length, 1);
  assert.equal(removeKey({ ...d, tracks: [{ target: "p", keys: [{ t: 0, props: { opacity: 1 } }] }] }, 0, 0), null);
});

test("motion-timeline: values, ease and labels", async () => {
  const { setKeyValue, setKeyEase, easeParts, bezierEase, parseValue, trackLabel } = await mod;
  const d = doc();
  assert.equal(setKeyValue(d, 0, 0, "opacity", " 0.25 ").tracks[0].keys[0].props.opacity, 0.25);
  assert.equal(setKeyValue(d, 1, 0, "transform", "scale(1.1)").tracks[1].keys[0].props.transform, "scale(1.1)");
  assert.equal(parseValue(""), "");
  assert.equal(setKeyEase(d, 0, 1, "linear").tracks[0].keys[1].ease, undefined);
  assert.equal(setKeyEase(d, 0, 2, "ease-in").tracks[0].keys[2].ease, "ease-in");
  assert.deepEqual(easeParts("cubic-bezier(0.2, 0.8, 0.2, 1.4)"), { key: "custom", bezier: [0.2, 0.8, 0.2, 1.4] });
  assert.equal(easeParts("bounce").key, "linear");
  assert.equal(bezierEase(["0.1", 0.2, "0.3", 1]), "cubic-bezier(0.1, 0.2, 0.3, 1)");
  const tree = [{ pid: "p-1", displayName: "main.page", children: [{ pid: "p-4", displayName: "article.card", children: [] }] }];
  assert.equal(trackLabel(tree, "p-4"), "article.card");
  assert.equal(trackLabel(tree, "p-9"), "p-9");
});
