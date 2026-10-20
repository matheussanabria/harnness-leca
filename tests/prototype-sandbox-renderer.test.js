// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { renderSandboxScreen } from "../ui/server/services/prototype-sandbox-renderer.service.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");

test("EP-12.21: Engine de Renderização em Sandbox Iframe Segura", async (t) => {
  await t.test("retorna 404 para protótipo inexistente", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "proto-inexistente", "home");
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
  });

  await t.test("retorna 404 para tela inexistente em protótipo existente", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "tela-fantasma");
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
  });

  await t.test("renderiza tela do protótipo dis-modular com CSP, nonce e tokens", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "home");
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);

    // Headers
    assert.ok(res.headers["Content-Security-Policy"].includes(`nonce-${res.nonce}`));
    assert.equal(res.headers["X-Frame-Options"], "SAMEORIGIN");
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");

    // HTML
    assert.ok(res.html.includes(`nonce="${res.nonce}"`));
    assert.ok(res.html.includes("data-node-id="));
    assert.ok(res.html.includes("dsTokensStyle"));
    assert.ok(res.html.includes("protoCustomStyle"));
    assert.ok(res.html.includes("harnessBridgeStyle"));
    assert.ok(res.html.includes("font-awesome"));
  });

  await t.test("estilos da ponte suportam seletores data-node-id e data-pid simultaneamente", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "home");
    assert.ok(res.html.includes("[data-node-id], [data-pid]"));
  });
});
