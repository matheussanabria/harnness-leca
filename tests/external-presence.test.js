// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-presence-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const HOME = path.join(TMP_ROOT, "fakehome");
const SLUG = "demo-proj";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "other-proj"), { recursive: true });

const { DatabaseSync } = require("node:sqlite");
const store = require("../ui/server/services/events/event-store");
const { projectSessions } = require("../ui/server/services/events/event-projector");
const { inferPresence } = require("../ui/server/services/external-presence/presence-inference");
const { defaultRoots } = require("../ui/server/services/external-presence/presence-config");
const { createPresenceScanner } = require("../ui/server/services/external-presence/presence-scanner");
const runtime = require("../ui/server/services/external-presence/presence-runtime");

test.after(() => {
  store.closeStore(SLUG);
  store.closeStore("other-proj");
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const NOW = Date.now();
const roots = defaultRoots(HOME);
const UUID = (n) => `${String(n).padStart(8, "0")}-1111-4222-8333-444455556666`;
let counter = 100;

function touch(file, ageMs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{}\n");
  const t = (NOW - ageMs) / 1000;
  fs.utimesSync(file, t, t);
}

function claudeFile(dir, id, ageMs) {
  touch(path.join(roots.claudeProjects, dir, `${id}.jsonl`), ageMs);
}

function db(file, sql) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec(sql);
  d.close();
}

function scanner(extra = {}) {
  return createPresenceScanner({ roots, now: () => NOW, host: "h", ...extra });
}

function events() {
  return store.readEvents(SLUG, { limit: 1000 }).events.filter((e) => e.source.kind === "presence-scanner");
}

test("inference table and boundaries", () => {
  const at = (age) => inferPresence(NOW - age, NOW);
  assert.deepEqual(at(0), { activity: "processing", presence: "connected" });
  assert.deepEqual(at(29_999), { activity: "processing", presence: "connected" });
  assert.deepEqual(at(30_000), { activity: "idle", presence: "connected" });
  assert.deepEqual(at(15 * 60_000 - 1), { activity: "idle", presence: "connected" });
  assert.deepEqual(at(15 * 60_000), { activity: "unknown", presence: "no_recent_signal" });
  assert.equal(at(8 * 3_600_000), null);
  assert.equal(inferPresence(Number.NaN, NOW), null);
});

test("claude: classified by age, publish only on change, replay is a no-op, no contents read", () => {
  const dir = "c--Users-x-git-demo-proj";
  const [a, b, c, d] = [UUID(1), UUID(2), UUID(3), UUID(4)];
  claudeFile(dir, a, 5_000);
  claudeFile(dir, b, 5 * 60_000);
  claudeFile(dir, c, 60 * 60_000);
  claudeFile(dir, d, 9 * 3_600_000);
  fs.mkdirSync(path.join(roots.claudeProjects, dir, a, "subagents"), { recursive: true });

  const reads = [];
  const orig = { rfs: fs.readFileSync, ofs: fs.openSync, cr: fs.createReadStream };
  fs.readFileSync = (...args) => { reads.push(String(args[0])); return orig.rfs(...args); };
  fs.openSync = (...args) => { reads.push(String(args[0])); return orig.ofs(...args); };
  fs.createReadStream = (...args) => { reads.push(String(args[0])); return orig.cr(...args); };
  const s = scanner({ readers: { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) } });
  try {
    s.scanOnce();
  } finally {
    Object.assign(fs, { readFileSync: orig.rfs, openSync: orig.ofs, createReadStream: orig.cr });
  }
  assert.deepEqual(reads.filter((f) => f.endsWith(".jsonl")), [], "transcripts must never be opened");

  const got = Object.fromEntries(events().map((e) => [e.nativeSessionId, e]));
  assert.equal(got[a].payload.activity, "processing");
  assert.equal(got[b].payload.activity, "idle");
  assert.equal(got[c].payload.presence, "no_recent_signal");
  assert.equal(got[c].payload.activity, "unknown");
  assert.equal(got[d], undefined, "older than 8h is not published");
  assert.equal(got[a].type, "session.discovered");
  assert.equal(got[a].relation, "inferred");
  assert.equal(got[a].trust, "inferred");
  assert.equal(got[a].sessionId, `claude:${a}`);
  assert.equal(got[a].engineInstanceId, "claude@h");
  assert.match(got[a].idempotencyKey, /^presence\|claude\|claude:.+\|processing\|connected\|\d+$/);
  assert.equal(got[a].payload.origin, "external");
  assert.equal(got[a].payload.signal, "mtime");

  const before = events().length;
  s.scanOnce();
  assert.equal(events().length, before, "unchanged state publishes nothing");

  const replay = scanner({ readers: { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) } });
  replay.scanOnce();
  assert.equal(events().length, before, "fresh scanner over the same store is idempotent");
  assert.ok(replay.getStats().duplicated >= 3);
});

test("state change publishes session.updated; processing heartbeat once per bucket", () => {
  const dir = "c--Users-x-git-demo-proj";
  const id = UUID(50);
  claudeFile(dir, id, 1_000);
  let now = NOW;
  const s = createPresenceScanner({ roots, now: () => now, host: "h", readers: { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) } });
  const count = () => events().filter((e) => e.nativeSessionId === id).length;
  s.scanOnce();
  assert.equal(count(), 1);
  now = NOW + 60_000; // idle now (age 61 s)
  s.scanOnce();
  const list = events().filter((e) => e.nativeSessionId === id);
  assert.equal(list.length, 2);
  assert.equal(list[1].type, "session.updated");
  assert.equal(list[1].payload.activity, "idle");
  s.scanOnce();
  assert.equal(count(), 2);
});

test("codex: rollout mtime + threads.cwd; subagent threads and unknown cwd are not published", () => {
  const day = new Date(NOW);
  const pad = (n) => String(n).padStart(2, "0");
  const dir = path.join(roots.codexHome, "sessions", String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()));
  const [main, child, orphan] = [UUID(10), UUID(11), UUID(12)];
  for (const id of [main, child, orphan]) touch(path.join(dir, `rollout-2026-01-01T00-00-00-${id}.jsonl`), 10_000);
  db(path.join(roots.codexHome, "state_5.sqlite"), `
    CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT NOT NULL);
    CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT PRIMARY KEY, status TEXT);
    INSERT INTO threads VALUES ('${main}', '\\\\?\\C:\\Users\\x\\git\\demo-proj'), ('${child}', 'C:\\Users\\x\\git\\demo-proj');
    INSERT INTO thread_spawn_edges VALUES ('${main}', '${child}', 'open');`);
  const s = scanner({ readers: { codex: (r, t) => require("../ui/server/services/external-presence/presence-sources-db").readCodex(r.codexHome, t) } });
  s.scanOnce();
  const ids = events().filter((e) => e.source.provider === "codex").map((e) => e.nativeSessionId);
  assert.deepEqual(ids, [main]);
  assert.equal(s.getStats().unmatched, 1, "rollout without a known cwd is counted, not invented");
});

test("antigravity: both brain roots, cwd from summaries db, unattributed skipped", () => {
  const [ide, second, none] = [UUID(20), UUID(21), UUID(22)];
  const log = (root, id, age) => touch(path.join(root, id, ".system_generated", "logs", "transcript.jsonl"), age);
  log(roots.antigravityBrains[0], ide, 45_000);
  log(roots.antigravityBrains[1], second, 20 * 60_000);
  log(roots.antigravityBrains[0], none, 1_000);
  db(roots.antigravitySummaryDbs[0], `
    CREATE TABLE conversation_summaries (conversation_id TEXT PRIMARY KEY, workspace_uris TEXT, parent_conversation_id TEXT NOT NULL DEFAULT '');
    INSERT INTO conversation_summaries (conversation_id, workspace_uris) VALUES
      ('${ide}', '["file:///c%3A/Users/x/git/demo-proj"]'), ('${second}', '["file:///c%3A/Users/x/git/demo-proj"]');`);
  const s = createPresenceScanner({ roots, now: () => NOW, host: "h", readers: { antigravity: (r, t) => {
    const f = require("../ui/server/services/external-presence/presence-sources-files");
    return require("../ui/server/services/external-presence/presence-sources-db").attachAntigravityWorkspaces(f.readAntigravity(r.antigravityBrains, t), r.antigravitySummaryDbs);
  } } });
  s.scanOnce();
  const got = Object.fromEntries(events().filter((e) => e.source.provider === "gemini").map((e) => [e.nativeSessionId, e.payload]));
  assert.equal(got[ide].activity, "idle");
  assert.equal(got[second].presence, "no_recent_signal");
  assert.equal(got[none], undefined);
  assert.equal(s.getStats().unmatched, 1);
});

test("opencode: top-level sessions from sqlite, time_updated in ms", () => {
  const top = "ses_top", sub = "ses_sub";
  db(roots.opencodeDb, `
    CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, directory TEXT, time_updated INTEGER, time_archived INTEGER);
    INSERT INTO session VALUES ('${top}', NULL, 'C:/Temp/demo-proj', ${NOW - 3_000}, NULL),
      ('${sub}', '${top}', 'C:/Temp/demo-proj', ${NOW - 3_000}, NULL),
      ('ses_old', NULL, 'C:/Temp/demo-proj', ${NOW - 9 * 3_600_000}, NULL);`);
  const s = scanner({ readers: { opencode: (r, t) => require("../ui/server/services/external-presence/presence-sources-db").readOpenCode(r.opencodeDb, t) } });
  s.scanOnce();
  const list = events().filter((e) => e.source.provider === "opencode");
  assert.deepEqual(list.map((e) => e.nativeSessionId), [top]);
  assert.equal(list[0].payload.activity, "processing");
});

test("two sessions of one engine are independent and the projection carries the new fields", () => {
  const dir = "c--Users-x-git-demo-proj";
  const [x, y] = [UUID(60), UUID(61)];
  claudeFile(dir, x, 2_000);
  claudeFile(dir, y, 10 * 60_000);
  claudeFile("c--Users-x-git-unknown-thing", UUID(62), 1_000);
  scanner({ readers: { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) } }).scanOnce();
  const views = Object.fromEntries(projectSessions(SLUG).sessions.map((v) => [v.sessionId, v]));
  assert.equal(views[`claude:${x}`].activity, "processing");
  assert.equal(views[`claude:${y}`].activity, "idle");
  const v = views[`claude:${x}`];
  assert.equal(v.origin, "external");
  assert.equal(v.presence, "connected");
  assert.equal(v.provider, "claude");
  assert.equal(v.nativeSessionId, x);
  assert.equal(v.executionStatus, null, "external sessions never invent an execution status");
  assert.ok(Date.parse(v.lastActivityAt) <= NOW && Date.parse(v.lastSeenAt) === NOW);
  assert.equal(views[`claude:${UUID(62)}`], undefined, "unmatched project is skipped");
});

test("errors never escape: failing source, failing publish, failing scanner, HARNESS_PRESENCE=0", () => {
  const failing = createPresenceScanner({ roots, now: () => NOW, readers: { claude: () => { throw new Error("boom"); }, ok: () => [] } });
  failing.scanOnce();
  assert.equal(failing.getStats().errors, 1);
  assert.equal(failing.getStats().sourceErrors.claude, 1);

  const bad = createPresenceScanner({ roots, now: () => NOW, publish: () => { throw new Error("db"); },
    readers: { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) } });
  bad.scanOnce();
  assert.ok(bad.getStats().failed > 0);

  let recorded = 0;
  const handle = runtime.startPresenceScanner({ env: {}, intervalMs: 1000, scanner: { scanOnce() { throw new Error("x"); }, getStats: () => ({}), recordError() { recorded += 1; } } });
  assert.ok(handle);
  assert.equal(recorded, 1);
  handle.stop();
  assert.equal(runtime.startPresenceScanner({ env: { HARNESS_PRESENCE: "0" } }), null);
  runtime.resetPresenceRuntime();
  assert.equal(runtime.getPresenceStats().enabled, false);
});

test("heartbeat: a session that stays processing re-emits at least every 2 minutes, bounded and never duplicated", () => {
  const dir = "c--Users-x-git-demo-proj";
  const id = UUID(70);
  const file = path.join(roots.claudeProjects, dir, `${id}.jsonl`);
  const reader = { claude: (r, t) => require("../ui/server/services/external-presence/presence-sources-files").readClaude(r.claudeProjects, t) };
  let now = NOW;
  const s = createPresenceScanner({ roots, now: () => now, host: "h", readers: reader });
  const times = [];
  for (let step = 0; step <= 12 * 60; step += 5) { // 12 minutes, scan every 5 s, agent writes every scan
    now = NOW + step * 1000;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{}\n");
    fs.utimesSync(file, now / 1000, now / 1000);
    s.scanOnce();
  }
  const list = events().filter((e) => e.nativeSessionId === id);
  for (const e of list) times.push(Date.parse(e.at));
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i] - times[i - 1] <= 2 * 60_000, "gap above 2 minutes");
  assert.ok(Date.now() >= 0 && list.length >= 6 && list.length <= 14, `bounded: got ${list.length}`);
  assert.equal(new Set(list.map((e) => e.idempotencyKey)).size, list.length, "each heartbeat is a distinct key");
  assert.ok(list.slice(1).every((e) => e.type === "session.updated" && e.payload.activity === "processing"));
});
