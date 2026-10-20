// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getPrototypeStudioWorkspace } from "../ui/server/services/prototype-studio.service.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");

test("EP-12.29: Integração da Árvore do Motor ao Studio Unificado", async (t) => {
  await t.test("lança erro para protótipo inexistente", () => {
    assert.throws(() => {
      getPrototypeStudioWorkspace(SAUDE_DIR, "proto-inexistente");
    }, /não encontrado/);
  });

  await t.test("projeta workspace virtual Vanilla com telas, estilos, data e manifestos", () => {
    const ws = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "vanilla");
    assert.equal(ws.protoId, "dis-modular");
    assert.equal(ws.framework, "vanilla");
    assert.ok(ws.totalFiles >= 4);

    const paths = ws.files.map((f) => f.path);
    assert.ok(paths.includes("proto.json"));
    assert.ok(paths.includes("styles/proto.css"));
    assert.ok(paths.includes("screens/home.html"));
    assert.ok(paths.includes("screens/home.js"));

    // Hashes SHA-256 presentes
    for (const f of ws.files) {
      assert.equal(f.hash.length, 64);
    }
  });

  await t.test("projeta workspace virtual Angular 18 com arquivos .ts, .html e .css", () => {
    const ws = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "angular18");
    assert.equal(ws.framework, "angular18");

    const paths = ws.files.map((f) => f.path);
    assert.ok(paths.includes("src/app/screens/home/home.component.ts"));
    assert.ok(paths.includes("src/app/screens/home/home.component.html"));
    assert.ok(paths.includes("src/app/screens/home/home.component.css"));

    const tsFile = ws.files.find((f) => f.path.endsWith(".ts"));
    assert.ok(tsFile.content.includes("standalone: true"));
    assert.ok(tsFile.content.includes("signal"));
  });

  await t.test("projeta workspace virtual React 18+ com arquivos .tsx e .css", () => {
    const ws = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "react18");
    assert.equal(ws.framework, "react18");

    const paths = ws.files.map((f) => f.path);
    assert.ok(paths.some((p) => p.endsWith("Screen.tsx")));
    assert.ok(paths.some((p) => p.endsWith("Screen.css")));

    const tsxFile = ws.files.find((f) => f.path.endsWith(".tsx"));
    assert.ok(tsxFile.content.includes("useState"));
  });
});
