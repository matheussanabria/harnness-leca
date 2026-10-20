// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderSandboxScreen } from "../ui/server/services/prototype-sandbox-renderer.service.js";
import { mutateHtmlByPid } from "../ui/server/services/prototype-editor.service.js";
import { mutateNodeProps } from "../ui/server/services/prototype-schema.service.js";
import { validatePrototypeDefinition } from "../ui/server/services/prototype-validator.service.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");

test("MARCO M2: Homologação do Protótipo Inspecionável (EP-12.21 a EP-12.24)", async (t) => {
  await t.test("M2.1 - Sandbox Renderer compila protótipo modular com CSP e isolamento", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "home");
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.ok(res.headers["Content-Security-Policy"].includes(`nonce-${res.nonce}`));
    assert.ok(res.html.includes("data-node-id="));
    assert.ok(res.html.includes("dsTokensStyle"));
    assert.ok(res.html.includes("protoCustomStyle"));
  });

  await t.test("M2.2 - Ponte e estilos suportam identificadores canônicos v2", () => {
    const res = renderSandboxScreen(SAUDE_DIR, REPO_ROOT, "dis-modular", "home");
    assert.ok(res.html.includes("[data-node-id], [data-pid]"));
    assert.ok(res.html.includes("HARNESS_PROTO_READY"));
    assert.ok(res.html.includes("findElementById"));
  });

  await t.test("M2.3 - Mutação de HTML na tela usando identificador canônico data-node-id", () => {
    const sampleHtml = `<div class="container"><button data-node-id="node-btn-acao" class="btn btn-primary">Salvar</button></div>`;
    
    // Mutação de texto
    const updatedText = mutateHtmlByPid(sampleHtml, "node-btn-acao", {
      type: "setText",
      text: "Confirmar Dispensação",
    });
    assert.ok(updatedText.includes("Confirmar Dispensação"));
    assert.ok(!updatedText.includes(">Salvar<"));

    // Mutação de classes
    const updatedClasses = mutateHtmlByPid(updatedText, "node-btn-acao", {
      type: "setClasses",
      classes: "btn btn-success btn-lg",
    });
    assert.ok(updatedClasses.includes('class="btn btn-success btn-lg"'));
    assert.ok(updatedClasses.includes("Confirmar Dispensação"));

    // Mutação de atributos
    const updatedAttr = mutateHtmlByPid(updatedClasses, "node-btn-acao", {
      type: "setAttr",
      name: "title",
      value: "Clique para confirmar a dispensação",
    });
    assert.ok(updatedAttr.includes('title="Clique para confirmar a dispensação"'));
  });

  await t.test("M2.4 - Mutação não destrutiva de props no proto.json preservando validação de schema", () => {
    const protoPath = path.join(SAUDE_DIR, "design", "prototypes", "dis-modular", "proto.json");
    assert.ok(fs.existsSync(protoPath));
    const proto = JSON.parse(fs.readFileSync(protoPath, "utf8"));

    // Aplica mutação semântica em nó
    const mutated = mutateNodeProps(proto, "home", "node-1", {
      title: "Atendimento Dispensação Atualizado",
      themeVariant: "primary-dark",
    });

    assert.equal(mutated.props.title, "Atendimento Dispensação Atualizado");
    assert.equal(mutated.props.themeVariant, "primary-dark");

    // Validação estrita do schema v2 após mutação
    const validation = validatePrototypeDefinition(proto);
    assert.equal(validation.valid, true, `Validação falhou: ${validation.errors.join(", ")}`);
  });
});
