// @ts-check
// EP-23.06: host selector. URL rules (HTTPS, or HTTP only on loopback, private networks and Tailscale), the token
// kept on the server (only its last 4 characters reach the browser), and each host's state read from its own
// /api/host/info with its PIN.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-hosts-"));
for (const dir of ["projects/demo", "global"]) fs.mkdirSync(path.join(TMP, dir), { recursive: true });
process.env.HARNESS_ROOT = TMP;
process.env.HARNESS_HOSTS_FILE = path.join(TMP, "data", "hosts.json");
process.env.HARNESS_HOST_NAME = "Desktop-Local";

const reg = require("../ui/server/services/host-registry");
const ui = await import("../ui/public/js/shared/host-selector.js");

test.after(() => {
  require("../ui/server/db/connection").closeDb();
  require("./helpers/temp-dir").removeDir(TMP);
});

test("RF4: HTTPS anywhere; HTTP only on loopback, private networks and Tailscale", () => {
  assert.equal(reg.validateHostUrl("https://harness.example.com/path?x=1"), "https://harness.example.com");
  for (const ok of ["http://localhost:4321", "http://127.0.0.1:4321", "http://192.168.0.20:4321", "http://10.1.2.3", "http://172.20.0.5", "http://100.101.102.103:4321", "http://vps.tail1234.ts.net"]) {
    assert.doesNotThrow(() => reg.validateHostUrl(ok), ok);
  }
  for (const bad of ["http://203.0.113.10:4321", "http://harness.example.com", "http://172.32.0.1", "http://100.128.0.1"]) {
    assert.throws(() => reg.validateHostUrl(bad), /HTTPS/, bad);
  }
  assert.throws(() => reg.validateHostUrl("https://user:pass@harness.example.com"), /usuário ou senha/); // allow-secret: fake credentials the validator must refuse
  assert.throws(() => reg.validateHostUrl("ftp://x"), /http/);
  assert.throws(() => reg.validateHostUrl("não é url"), /inválida/);
});

test("the token stays on the server: masked (2 characters for a PIN, 4 for a long token), kept when the form leaves it empty", () => {
  const saved = reg.saveHost({ name: "Desktop VPS", url: "https://vps.example.com", token: "123456789" });
  assert.equal(saved.id, "desktop-vps");
  assert.equal(reg.publicHost(saved).tokenHint, "••••6789");
  assert.equal(reg.publicHost({ id: "p", name: "p", url: "https://p", token: "482913" }).tokenHint, "••••13", "a 6-digit PIN shows 2 digits only");
  assert.doesNotMatch(JSON.stringify(reg.publicHost(saved)), /12345/);
  const renamed = reg.saveHost({ id: "desktop-vps", name: "VPS", url: "https://vps.example.com", token: "" });
  assert.equal(renamed.token, "123456789", "an empty token keeps the stored one");
  assert.equal(reg.readHosts().length, 1);
  assert.equal(reg.removeHost("desktop-vps"), true);
  assert.equal(reg.removeHost("desktop-vps"), false);
});

/** A fake remote host: /api/host/info answers by PIN. @param {{ pin: string, protocol?: number }} opts */
function fakeHost({ pin, protocol = reg.HOST_INFO_PROTOCOL }) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/api/host/info") return res.writeHead(404).end();
    if (req.headers["x-harness-pin"] !== pin) return res.writeHead(401, { "Content-Type": "application/json" }).end("{}");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ name: "VPS", version: "9.9.9", protocol }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("GET /api/hosts shows this host and each saved host's state, without the token", async () => {
  const good = /** @type {http.Server} */ (await fakeHost({ pin: "4321" }));
  const old = /** @type {http.Server} */ (await fakeHost({ pin: "4321", protocol: 0 }));
  const url = (/** @type {http.Server} */ s) => `http://127.0.0.1:${/** @type {any} */ (s.address()).port}`;
  reg.saveHost({ name: "VPS", url: url(good), token: "4321" });
  reg.saveHost({ name: "VPS sem PIN", url: url(good), token: "0000" });
  reg.saveHost({ name: "Antigo", url: url(old), token: "4321" });
  reg.saveHost({ name: "Desligado", url: "http://127.0.0.1:1", token: "" });
  const { createServer } = require("../ui/server");
  const web = createServer();
  await new Promise((resolve) => web.listen(0, "127.0.0.1", () => resolve(undefined)));
  try {
    const res = await fetch(`http://127.0.0.1:${/** @type {any} */ (web.address()).port}/api/hosts`);
    const data = await res.json();
    assert.equal(data.current.name, "Desktop-Local");
    const state = Object.fromEntries(data.hosts.map((/** @type {any} */ h) => [h.name, h.status.state]));
    assert.deepEqual(state, { VPS: "online", "VPS sem PIN": "locked", Antigo: "incompatible", Desligado: "offline" });
    assert.doesNotMatch(JSON.stringify(data), /"token"|4321/, "no whole token in the answer");
    const info = await (await fetch(`http://127.0.0.1:${/** @type {any} */ (web.address()).port}/api/host/info`)).json();
    assert.deepEqual(Object.keys(info).sort(), ["name", "protocol", "version"]);
  } finally {
    web.closeAllConnections();
    web.close();
    good.close();
    old.close();
  }
});

test("selector markup: state as text and icon, Abrir only for a reachable host, no emojis", () => {
  const online = ui.hostRowHtml({ id: "vps", name: "VPS", url: "https://vps.example.com", tokenHint: "••••4321", status: { state: "online", version: "1.0" } });
  assert.match(online, /fa-solid fa-circle-check/);
  assert.match(online, /no ar · 1\.0/);
  assert.match(online, /href="https:\/\/vps\.example\.com\/"/);
  const offline = ui.hostRowHtml({ id: "x", name: "X", url: "https://x.example.com", status: { state: "offline" } });
  assert.doesNotMatch(offline, /Abrir/);
  assert.match(offline, /fora do ar/);
  const panel = ui.hostPanelHtml({ current: { name: "Desktop-Local", version: "1.0" }, hosts: [] });
  assert.match(panel, /Em uso: <strong>Desktop-Local<\/strong>/);
  assert.match(panel, /type="password"/);
  assert.doesNotMatch(online + panel, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(ui.hostRowHtml({ id: "<x>", name: "<script>", url: "https://a", status: {} }), /<script>/, "escaped");
});
