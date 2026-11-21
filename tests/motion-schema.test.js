// @ts-check
// EP-24.01: pure validator for the motion@1 timeline format (ADR-018).
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMotion, extractPids, isValidEase } = require("../ui/server/services/motion-schema.service");

/** @param {object} [over] */
function doc(over = {}) {
  return {
    schema: "motion@1", duration: 1000, fps: 30, loop: false, size: { w: 1280, h: 720 },
    tracks: [
      { target: "p-1", keys: [{ t: 0, props: { opacity: 0, transform: "translateY(24px)" } }, { t: 600, props: { opacity: 1, transform: "translateY(0)" }, ease: "ease-out" }] },
      { target: "p-2", keys: [{ t: 200, props: { opacity: 0 } }, { t: 800, props: { opacity: 1 } }] },
    ],
    ...over,
  };
}

/** @param {{ errors: { code: string }[] }} r */
const codes = (r) => r.errors.map((e) => e.code);

test("motion-schema: a valid document passes with no warnings", () => {
  const r = validateMotion(doc(), { pids: ["p-1", "p-2"] });
  assert.deepEqual(r, { ok: true, errors: [], warnings: [] });
});

test("CP-02: a prop outside the allowed list is rejected with track, key and prop in the path", () => {
  const d = doc();
  d.tracks[1].keys[1].props = { left: "10px" };
  const r = validateMotion(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{ path: "tracks[1].keys[1].props.left", code: "prop_not_allowed", message: 'prop "left" is not in the allowed list' }]);
});

test("CP-03: a track whose target is not on the screen is accepted with an orphan_track warning", () => {
  const d = doc();
  d.tracks[1].target = "p-9";
  const r = validateMotion(d, { pids: ["p-1", "p-2"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.map((w) => [w.path, w.code]), [["tracks[1].target", "orphan_track"]]);
});

test("motion-schema: header limits (schema, duration, fps, loop, size)", () => {
  assert.deepEqual(codes(validateMotion(doc({ schema: "motion@2" }))), ["invalid_schema"]);
  assert.deepEqual(codes(validateMotion(doc({ duration: 60001 }))), ["invalid_duration"]);
  assert.deepEqual(codes(validateMotion(doc({ fps: 25 }))), ["invalid_fps"]);
  assert.deepEqual(codes(validateMotion(doc({ loop: "yes" }))), ["invalid_loop"]);
  assert.deepEqual(codes(validateMotion(doc({ size: { w: 8, h: 720 } }))), ["invalid_size"]);
  assert.deepEqual(codes(validateMotion(null)), ["invalid_document"]);
});

test("motion-schema: key times must stay in range and strictly increase", () => {
  const d = doc({ duration: 500 });
  const r = validateMotion(d);
  assert.deepEqual(r.errors.map((e) => [e.path, e.code]), [
    ["tracks[0].keys[1].t", "time_out_of_range"],
    ["tracks[1].keys[1].t", "time_out_of_range"],
  ]);
  const back = doc();
  back.tracks[1].keys[1].t = 200;
  assert.deepEqual(codes(validateMotion(back)), ["time_not_increasing"]);
});

test("motion-schema: duplicate targets, bad targets, empty keys and too many tracks", () => {
  const dup = doc();
  dup.tracks[1].target = "p-1";
  assert.deepEqual(codes(validateMotion(dup)), ["duplicate_target"]);
  const bad = doc();
  bad.tracks[0].target = "#main .card";
  assert.deepEqual(codes(validateMotion(bad)), ["invalid_target"]);
  const empty = doc();
  empty.tracks[0].keys = [];
  assert.deepEqual(codes(validateMotion(empty)), ["keys_required"]);
  const many = doc({ tracks: Array.from({ length: 201 }, (_, i) => ({ target: `p-${i}`, keys: [{ t: 0, props: { opacity: 1 } }] })) });
  assert.deepEqual(codes(validateMotion(many)), ["too_many_tracks"]);
});

test("motion-schema: values reject markup, url() and declarations", () => {
  for (const value of ["url(https://x.test/a.svg)", "red; position: fixed", "<b>", "expression(alert(1))", ""]) {
    const d = doc();
    d.tracks[0].keys[0].props = { filter: value };
    assert.deepEqual(codes(validateMotion(d)), ["invalid_value"], value);
  }
});

test("motion-schema: ease keywords and cubic-bezier", () => {
  assert.equal(isValidEase("ease-in-out"), true);
  assert.equal(isValidEase("cubic-bezier(0.2, 0.8, 0.2, 1.4)"), true);
  assert.equal(isValidEase("cubic-bezier(1.2, 0, 0, 1)"), false);
  assert.equal(isValidEase("bounce"), false);
  const d = doc();
  d.tracks[0].keys[1].ease = "spring";
  assert.deepEqual(codes(validateMotion(d)), ["invalid_ease"]);
});

test("motion-schema: extractPids reads data-pid values from screen HTML", () => {
  assert.deepEqual([...extractPids('<div data-pid="p-1"><span data-pid="p-2">x</span></div>')], ["p-1", "p-2"]);
  assert.equal(extractPids("").size, 0);
});
