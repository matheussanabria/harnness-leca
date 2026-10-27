// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { getEngineActivity } = require("../ui/server/controllers/engine-activity.controller");
const { getEngineMonitor } = require("../tools/lib/engine-monitor/monitor.service");

test("engine-monitor-http: GET /api/engines/activity responde 200 em loopback com contrato válido", async () => {
  const monitor = getEngineMonitor();
  monitor.recordEvent("opencode", { toolName: "view_file" }, "ses_test_1");

  const req = /** @type {any} */ ({
    socket: { remoteAddress: "127.0.0.1" },
    headers: {},
  });

  let statusCode = 0;
  let headers = {};
  let body = "";

  const res = /** @type {any} */ ({
    writeHead: (code, h) => {
      statusCode = code;
      headers = h;
    },
    end: (chunk) => {
      body = chunk;
    },
  });

  await getEngineActivity(req, res);

  assert.equal(statusCode, 200);
  assert.ok(headers["Content-Type"].includes("application/json"));
  const data = JSON.parse(body);
  assert.ok(data.geradoEm);
  assert.ok(Array.isArray(data.motores));
  assert.ok(data.motores.length >= 4);

  const opencode = data.motores.find((m) => m.id === "opencode");
  assert.ok(opencode);
  assert.ok(["online", "offline"].includes(opencode.presenca));
});

test("engine-monitor-http: recusa acesso de IPs fora do loopback (403)", async () => {
  const req = /** @type {any} */ ({
    socket: { remoteAddress: "192.168.1.50" },
    headers: {},
  });

  let statusCode = 0;
  const res = /** @type {any} */ ({
    writeHead: (code) => { statusCode = code; },
    end: () => {},
  });

  await getEngineActivity(req, res);
  assert.equal(statusCode, 403);
});
