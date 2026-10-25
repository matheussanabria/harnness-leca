// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempDir } from "./helpers/temp-dir.js";
import { renderSandboxScreen } from "../ui/server/services/prototype-sandbox-renderer.service.js";

function makeProject(metadata) {
  const dir = makeTempDir("ds-render-", test);
  const proto = path.join(dir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(proto, "screens"), { recursive: true });
  fs.mkdirSync(path.join(dir, "design", "ds"), { recursive: true });
  fs.writeFileSync(path.join(proto, "screens", "home.html"), '<div data-pid="p-1">oi</div>');
  fs.writeFileSync(path.join(proto, "proto.json"), JSON.stringify({ schema: 1, id: "p1", screens: [{ id: "home", file: "screens/home.html" }], metadata }));
  fs.writeFileSync(path.join(dir, "design", "ds", "tokens.css"), ":root{--x:1}");
  fs.writeFileSync(path.join(dir, "design", "ds", "components.css"), ".ds-btn{color:red}");
  return dir;
}

test("components.css só entra quando metadata.dsComponents é true", () => {
  const on = renderSandboxScreen(makeProject({ dsComponents: true }), ".", "p1", "home");
  assert.ok(on.html.includes('id="dsComponentsStyle"'));
  assert.ok(on.html.indexOf("dsComponentsStyle") < on.html.indexOf("protoCustomStyle"));
  assert.ok(on.html.includes(".ds-btn{color:red}"));
  const off = renderSandboxScreen(makeProject({}), ".", "p1", "home");
  assert.equal(off.html.includes("dsComponentsStyle"), false);
});
