// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveNodeTraceability } from "../ui/server/services/prototype-traceability.service.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");
const SERVICE_PATH = path.join(REPO_ROOT, "ui", "server", "services", "prototype-traceability.service.js");

test("EP-12.30: Rastreabilidade End-to-End (Tela -> Nó -> Componente -> Código)", async (t) => {
  await t.test("serviço cumpre o limite de 250 linhas e não contém emojis", () => {
    assert.ok(fs.existsSync(SERVICE_PATH));
    const content = fs.readFileSync(SERVICE_PATH, "utf8");
    const lines = content.split("\n").length;
    assert.ok(lines <= 250, `Arquivo com ${lines} linhas (limite 250).`);

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
    assert.equal(emojiRegex.test(content), false, "Não deve conter emojis.");
  });

  await t.test("lança erro amigável para nó ou protótipo inexistente", () => {
    assert.throws(() => {
      resolveNodeTraceability(SAUDE_DIR, "proto-inexistente", "home", "node-1");
    }, /não encontrado/);

    assert.throws(() => {
      resolveNodeTraceability(SAUDE_DIR, "dis-modular", "home", "node-fantasma-999");
    }, /não encontrado/);
  });

  await t.test("resolve grafo completo para nó real do protótipo clínico dis-modular", () => {
    const trace = resolveNodeTraceability(SAUDE_DIR, "dis-modular", "home", "node-2");
    assert.equal(trace.protoId, "dis-modular");
    assert.equal(trace.screenId, "home");
    assert.equal(trace.nodeId, "node-2");

    // Metadados do nó
    assert.ok(trace.node.componentId);

    // Geração de código nos 3 frameworks
    assert.ok(typeof trace.code.vanilla === "string");
    assert.ok(typeof trace.code.angular18 === "string");
    assert.ok(typeof trace.code.react18 === "string");

    assert.ok(trace.code.vanilla.includes('data-node-id="node-2"'));
    assert.ok(trace.code.angular18.includes('data-node-id="node-2"'));
    assert.ok(trace.code.react18.includes('data-node-id="node-2"'));
  });
});
