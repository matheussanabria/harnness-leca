// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderSandboxScreen } from "../ui/server/services/prototype-sandbox-renderer.service.js";
import { createProjectFixture } from "./helpers/project-fixture.js";

const REPO_ROOT = path.resolve(".");
const BRIDGE_PATH = path.join(REPO_ROOT, "ui", "public", "js", "modules", "prototype-bridge.js");
const fixture = createProjectFixture();
const SAUDE_DIR = fixture.dir;
test.after(() => fixture.cleanup());

test("EP-12.22: Ponte de Comunicação Bidirecional (prototype-bridge.js)", async (t) => {
  await t.test("arquivo prototype-bridge.js existe e cumpre o limite estrito de linhas", () => {
    assert.ok(fs.existsSync(BRIDGE_PATH));
    const content = fs.readFileSync(BRIDGE_PATH, "utf8");
    const lineCount = content.split("\n").length;
    assert.ok(lineCount <= 250, `Arquivo com ${lineCount} linhas, excedeu limite de 250.`);
  });

  await t.test("script da ponte contempla eventos canônicos e suporte duplo nodeId/pid", () => {
    const content = fs.readFileSync(BRIDGE_PATH, "utf8");
    assert.ok(content.includes("data-node-id"));
    assert.ok(content.includes("data-pid"));
    assert.ok(content.includes("HARNESS_PROTO_READY"));
    assert.ok(content.includes("HARNESS_PROTO_TREE"));
    assert.ok(content.includes("HARNESS_PROTO_SELECT"));
    assert.ok(content.includes("HARNESS_PROTO_GOTO"));
    assert.ok(content.includes("HARNESS_PROTO_SELECT_BY_ID"));
    assert.ok(content.includes("HARNESS_PROTO_HIGHLIGHT"));
  });

  await t.test("a ponte é embutida com sucesso na renderização de tela da sandbox", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "home");
    assert.equal(res.ok, true);
    assert.ok(res.html.includes("HARNESS_PROTO_READY"));
    assert.ok(res.html.includes("findElementById"));
  });
});
