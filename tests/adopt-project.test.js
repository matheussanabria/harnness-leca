const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");

// HARNESS_ROOT must be set before the tool is loaded: ROOT is resolved at require time.
const root = makeTempDir("adopt-root-", test);
process.env.HARNESS_ROOT = root;
fs.mkdirSync(path.join(root, "projects"), { recursive: true });
const { run } = require("../tools/adopt-project");
const { detectStack } = require("../tools/lib/adopt/detect-stack");

const quiet = { log() {} };
const write = (dir, name, content) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), content); };

function angularApp() {
  const dir = makeTempDir("My App-", test);
  write(dir, "package.json", JSON.stringify({
    name: "my-app", scripts: { start: "ng serve", test: "ng test", build: "ng build" },
    dependencies: { "@angular/core": "^18.2.0" }, devDependencies: { typescript: "^5.4.0", eslint: "^9.0.0" },
  }));
  write(dir, "README.md", "# My App\n\nInternal tool for scheduling.\n\nMore text.\n");
  write(dir, "Dockerfile", "FROM node:22\n");
  return dir;
}

test("detectStack reads Node manifests, scripts and README summary", () => {
  const s = detectStack(angularApp());
  assert.deepEqual(s.languages, ["TypeScript"]);
  assert.deepEqual(s.frameworks, ["Angular 18"]);
  assert.ok(s.tools.includes("ESLint") && s.tools.includes("Docker"));
  assert.deepEqual(s.commands.map((c) => c.label), ["start", "build", "test"]);
  assert.equal(s.summary, "Internal tool for scheduling.");
});

test("detectStack finds Spring Boot in a subfolder and ignores node_modules", () => {
  const dir = makeTempDir("mono-", test);
  write(dir, "api/pom.xml", "<project><java.version>21</java.version><artifactId>spring-boot-starter</artifactId></project>");
  write(dir, "node_modules/x/package.json", JSON.stringify({ dependencies: { react: "1.0.0" } }));
  const s = detectStack(dir);
  assert.deepEqual(s.languages, ["Java"]);
  assert.deepEqual(s.frameworks, ["Spring Boot"]);
  assert.ok(s.notes.some((n) => n.includes("Java 21")));
});

test("adopt creates the project, seeds files, adds an alias and never overwrites", () => {
  const src = angularApp();
  const r = run(["--path", src, "--slug", "my-app"], quiet);
  const proj = path.join(root, "projects", "my-app");
  assert.equal(r.created, true);
  assert.match(fs.readFileSync(path.join(proj, "instructions.md"), "utf8"), /Angular 18/);
  assert.match(fs.readFileSync(path.join(proj, "memory.md"), "utf8"), /^- \[\d{4}-\d{2}-\d{2}\] Stack detected/m);
  const aliases = JSON.parse(fs.readFileSync(path.join(root, "projects", ".sources.json"), "utf8"));
  assert.deepEqual(aliases["my-app"], [path.basename(src)]);
  for (const sub of ["chats", "context", "scheduled"]) assert.ok(fs.statSync(path.join(proj, sub)).isDirectory());

  fs.writeFileSync(path.join(proj, "instructions.md"), "mine");
  const again = run(["--path", src, "--slug", "my-app"], quiet);
  assert.equal(again.created, false);
  assert.equal(again.aliased, false);
  assert.equal(fs.readFileSync(path.join(proj, "instructions.md"), "utf8"), "mine");
});

test("dry run writes nothing", () => {
  const src = angularApp();
  run(["--path", src, "--slug", "dry-one", "--dry-run"], quiet);
  assert.equal(fs.existsSync(path.join(root, "projects", "dry-one")), false);
});

test("invalid input is rejected", () => {
  assert.throws(() => run([], quiet), /Usage/);
  assert.throws(() => run(["--path", path.join(root, "nope")], quiet), /not found/);
  assert.throws(() => run(["--path", angularApp(), "--slug", "../evil"], quiet), /Invalid slug/);
  assert.throws(() => run(["--path", path.join(root, "projects"), "--slug", "x"], quiet), /inside the harness/);
});
