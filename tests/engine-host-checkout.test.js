// EP-23.07: the engine host per checkout. A host of another checkout (own folder, own token) holds a port; the checkout
// that finds it must be told whose it is and how to get rid of it, and its stop and restart commands must not claim
// success. Real host child processes on free ports; nothing here touches port 4322.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { checkoutPort, checkoutKind, resolveHostPort, DEFAULT_PORT, RANGE_START, RANGE_SIZE } = require("../ui/server/services/engine-host/checkout-port");

const HOST_SCRIPT = path.join(__dirname, "..", "ui", "engine-host.js");
const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

test("CP-05: the main checkout keeps 4322; a linked worktree gets a stable port in 4400-4499 derived from its folder", () => {
  assert.equal(checkoutPort("C:/work/harness", "main"), DEFAULT_PORT);
  assert.equal(checkoutPort("C:/work/harness", "unknown"), DEFAULT_PORT, "git gave no answer: today's behavior");
  const linked = checkoutPort("C:/work/harness/.claude/worktrees/ep-24", "linked");
  assert.ok(linked >= RANGE_START && linked < RANGE_START + RANGE_SIZE, String(linked));
  assert.equal(linked, checkoutPort("C:/work/harness/.claude/worktrees/ep-24", "linked"), "stable between calls");
  assert.equal(checkoutPort("C:\\Work\\Harness\\wt\\", "linked"), checkoutPort("c:/work/harness/wt", "linked"), "spelling does not matter");
  const ports = new Set(Array.from({ length: 30 }, (_, i) => checkoutPort(`C:/work/harness/.claude/worktrees/w${i}`, "linked")));
  assert.ok(ports.size >= 20, `30 different folders should spread over many ports, got ${ports.size}`);
});

test("CP-05: HARNESS_ENGINE_HOST_PORT always wins, even 0; an invalid value falls back to the checkout port", () => {
  const kind = () => "linked";
  const base = { root: "C:/work/wt", kind };
  assert.equal(resolveHostPort({ ...base, env: { HARNESS_ENGINE_HOST_PORT: "0" } }), 0);
  assert.equal(resolveHostPort({ ...base, env: { HARNESS_ENGINE_HOST_PORT: "4322" } }), 4322, "the rollback: force the old port");
  assert.equal(resolveHostPort({ ...base, env: {} }), checkoutPort("C:/work/wt", "linked"));
  assert.equal(resolveHostPort({ ...base, env: { HARNESS_ENGINE_HOST_PORT: "abc" } }), checkoutPort("C:/work/wt", "linked"));
  assert.equal(resolveHostPort({ ...base, env: { HARNESS_ENGINE_HOST_PORT: "" } }), checkoutPort("C:/work/wt", "linked"));
});

test("CP-05: checkoutKind tells main from a linked worktree by git, and says unknown when git fails", () => {
  const answer = (dir, common) => (args) => (args[1] === "--git-dir" ? dir : common);
  assert.equal(checkoutKind("/r", answer(".git", ".git")), "main");
  assert.equal(checkoutKind("/r", answer("/r/.git/worktrees/wt", "/r/.git")), "linked");
  assert.equal(checkoutKind("/r", () => { throw new Error("not a git repository"); }), "unknown");
});

// ---------- real hosts ----------

const children = [];
const tmpDirs = [];
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-host-checkout-")); tmpDirs.push(dir); return dir; };
test.after(() => {
  for (const child of children) child.kill();
  for (const dir of tmpDirs) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold a handle */ }
});

/** A host of "another checkout": its own root folder, token file and database, on a free port. */
function startOwnerHost() {
  const root = tmp();
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "engine-host.token"), `${TOKEN_A}\n`);
  const env = { ...process.env, HARNESS_ROOT: root, HARNESS_ENGINE_HOST_PORT: "0", HARNESS_ENGINE_HOST_TOKEN_FILE: path.join(root, "data", "engine-host.token"), HARNESS_DB_PATH: path.join(root, "harness.sqlite"), HIA_ROUTING_ENABLED: "false" };
  const child = spawn(process.execPath, [HOST_SCRIPT], { env });
  children.push(child);
  return new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      const m = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
      if (m) resolve({ base: m[1], pid: child.pid, child, folder: path.basename(root), tokenFile: path.join(root, "data", "engine-host.token") });
    });
    child.on("exit", (code) => reject(new Error(`host exited ${code}: ${out}`)));
  });
}

/** Environment of a checkout that is NOT the owner: another root and another token. */
function foreignEnv(base) {
  const root = tmp();
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  const tokenFile = path.join(root, "data", "engine-host.token");
  fs.writeFileSync(tokenFile, `${TOKEN_B}\n`);
  return { root, tokenFile, env: { ...process.env, HARNESS_ROOT: root, HARNESS_ENGINE_HOST_URL: base, HARNESS_ENGINE_HOST_TOKEN_FILE: tokenFile, HARNESS_ENGINE_HOST_AUTOSTART: "0" } };
}

/** Runs the host CLI as another process (the host under test lives in a third one, so nothing blocks). */
function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOST_SCRIPT, ...args], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("CP-01: a host of another checkout is named in the error, with its folder and pid", async () => {
  const owner = await startOwnerHost();
  const { env } = foreignEnv(owner.base);
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const { ensureHost, HostUnavailableError } = require("../ui/server/services/engine-host-client");
    await assert.rejects(ensureHost(), (error) => {
      assert.ok(error instanceof HostUnavailableError);
      assert.equal(error.message, `Já existe um host de motores da pasta "${owner.folder}" (pid ${owner.pid}) nesta porta. Pare-o dentro dessa pasta (npm run host:stop) ou encerre o processo ${owner.pid}.`);
      return true;
    });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("CP-01: a host that has no /identity (an older one) is reported as an unknown owner, with the port", async () => {
  // A real pre-23.07 host answers 401 to any route without its token, /identity included (observed on port 4322).
  const old = http.createServer((req, res) => { res.writeHead(401, { "Content-Type": "application/json" }); res.end("{}"); });
  await new Promise((resolve) => old.listen(0, "127.0.0.1", resolve));
  const port = old.address().port;
  const saved = { ...process.env };
  Object.assign(process.env, foreignEnv(`http://127.0.0.1:${port}`).env, { HARNESS_ENGINE_HOST_PORT: String(port) });
  try {
    const { foreignHostMessage } = require("../ui/server/services/engine-host-client");
    assert.equal(await foreignHostMessage(), `Há um host de motores de dono desconhecido na porta ${port}. Encerre o processo que usa essa porta ou defina HARNESS_ENGINE_HOST_PORT.`);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    old.close();
  }
});

test("CP-02: stop and restart from the wrong checkout fail with the owner's name, never claim success, and leave the host up", async () => {
  const owner = await startOwnerHost();
  const { env } = foreignEnv(owner.base);

  const stop = await runCli(["--stop"], env);
  assert.equal(stop.code, 1, `stdout: ${stop.stdout} stderr: ${stop.stderr}`);
  assert.doesNotMatch(stop.stdout + stop.stderr, /stop requested/);
  assert.match(stop.stderr, new RegExp(`Já existe um host de motores da pasta "${owner.folder}" \\(pid ${owner.pid}\\)`));

  const restart = await runCli(["--restart"], env);
  assert.equal(restart.code, 1, `stdout: ${restart.stdout} stderr: ${restart.stderr}`);
  assert.doesNotMatch(restart.stdout, /not running or not reachable/);
  assert.match(restart.stdout, new RegExp(`da pasta "${owner.folder}" \\(pid ${owner.pid}\\)`));

  const still = await fetch(`${owner.base}/identity`);
  assert.equal(still.status, 200, "the host is still running");
});

test("CP-03: stop from the owner's own checkout ends the host", async () => {
  const owner = await startOwnerHost();
  const env = { ...process.env, HARNESS_ROOT: path.dirname(path.dirname(owner.tokenFile)), HARNESS_ENGINE_HOST_URL: owner.base, HARNESS_ENGINE_HOST_TOKEN_FILE: owner.tokenFile };
  const exited = new Promise((resolve) => owner.child.on("exit", resolve));
  const stop = await runCli(["--stop"], env);
  assert.equal(stop.code, 0, `stdout: ${stop.stdout} stderr: ${stop.stderr}`);
  assert.match(stop.stdout, /stop requested; runs cut: 0/);
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error("host did not exit")), 5000))]);
});

test("CP-04: /identity needs no token and shows only the folder name, pid and start time; everything else still needs the token", async () => {
  const owner = await startOwnerHost();
  const identity = await fetch(`${owner.base}/identity`);
  assert.equal(identity.status, 200);
  const text = await identity.text();
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body).sort(), ["app", "checkout", "pid", "startedAt"]);
  assert.deepEqual([body.app, body.checkout, body.pid], ["harness-engine-host", owner.folder, owner.pid]);
  assert.ok(!Number.isNaN(Date.parse(body.startedAt)));
  assert.ok(!text.includes(os.tmpdir()), "no full path");
  assert.ok(!text.includes(TOKEN_A), "no token");
  for (const route of ["/health", "/runs"]) assert.equal((await fetch(`${owner.base}${route}`)).status, 401, route);
  assert.equal((await fetch(`${owner.base}/health`, { headers: { "x-harness-host-token": TOKEN_A } })).status, 200, "the right token still works");
  assert.equal((await fetch(`${owner.base}/identity`, { method: "POST" })).status, 401, "identity is GET only");
});
