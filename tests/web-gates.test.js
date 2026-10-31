const test = require("node:test");
const assert = require("node:assert/strict");
const { webGates } = require("../scripts/lib/web-gates");

const recorder = (status = 0) => {
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, ...args].join(" ")); return { status, output: "boom" }; };
  return { calls, run };
};

test("web gates skip commits that do not touch ui/web or the package files", () => {
  const { calls, run } = recorder();
  assert.deepEqual(webGates("/repo", ["ui/public/js/app.js", "README.md"], run), []);
  assert.equal(calls.length, 0);
});

test("web gates lint staged island files and type-check both web projects", () => {
  const { calls, run } = recorder();
  assert.deepEqual(webGates("/repo", ["ui/web/src/islands/lab/main.tsx", "ui/web/package.json"], run), []);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /biome.*check.*main\.tsx/);
  assert.doesNotMatch(calls[0], /ui\/web\/package\.json/);
  assert.match(calls[1], /tsc -p ui\/web$/);
  assert.match(calls[2], /tsc -p ui\/web\/tsconfig\.node\.json$/);
});

test("web gates run npm audit when dependencies change and report failures", () => {
  const { calls, run } = recorder(1);
  const problems = webGates("/repo", ["package-lock.json"], run);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^npm audit --omit=dev --audit-level=high$/);
  assert.match(problems[0], /npm audit/);
});

test("web gates warn instead of blocking when npm audit cannot reach the registry", () => {
  const run = () => ({ status: 1, output: "npm error code ENOTFOUND\nnpm error network request failed" });
  assert.deepEqual(webGates("/repo", ["package.json"], run), []);
});
