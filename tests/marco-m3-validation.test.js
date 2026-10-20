// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getPrototypeStudioWorkspace } from "../ui/server/services/prototype-studio.service.js";
import { resolveNodeTraceability } from "../ui/server/services/prototype-traceability.service.js";
import { generateScreenCode } from "../ui/server/services/prototype-codegen.factory.js";
import { validatePrototypeDefinition } from "../ui/server/services/prototype-validator.service.js";
import { resolveNodeNavigation } from "../ui/server/services/prototype-schema.service.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");
const PROTO_PATH = path.join(SAUDE_DIR, "design", "prototypes", "dis-modular", "proto.json");

test("MARCO M3: Homologação Final do Studio Multiframework (EP-12)", async (t) => {
  assert.ok(fs.existsSync(PROTO_PATH), "proto.json deve existir");
  const proto = JSON.parse(fs.readFileSync(PROTO_PATH, "utf8"));

  await t.test("M3.1 - Studio Workspace projeta artefatos virtuais nos 3 frameworks", () => {
    const wsVanilla = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "vanilla");
    const wsAngular = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "angular18");
    const wsReact = getPrototypeStudioWorkspace(SAUDE_DIR, "dis-modular", "react18");

    assert.equal(wsVanilla.framework, "vanilla");
    assert.equal(wsAngular.framework, "angular18");
    assert.equal(wsReact.framework, "react18");

    assert.ok(wsVanilla.files.some((f) => f.path === "screens/prescricao.html"));
    assert.ok(wsAngular.files.some((f) => f.path.includes("prescricao.component.ts")));
    assert.ok(wsReact.files.some((f) => f.path.includes("PrescricaoScreen.tsx")));
  });

  await t.test("M3.2 - Rastreabilidade End-to-End fecha o grafo Tela -> Nó -> Componente -> Código", () => {
    const trace = resolveNodeTraceability(SAUDE_DIR, "dis-modular", "prescricao", "node-btn-avancar-aut");

    assert.equal(trace.nodeId, "node-btn-avancar-aut");
    assert.equal(trace.node.componentId, "dis.button");

    // Código nos 3 frameworks gerado dinamicamente para o nó
    assert.ok(trace.code.vanilla.includes('data-node-id="node-btn-avancar-aut"'));
    assert.ok(trace.code.angular18.includes('data-node-id="node-btn-avancar-aut"'));
    assert.ok(trace.code.react18.includes('data-node-id="node-btn-avancar-aut"'));

    // Ações de navegação preservadas
    assert.ok(trace.code.vanilla.includes('data-action="goto:autorizacao"'));
    assert.ok(trace.code.angular18.includes("(click)=\"onNavigate('autorizacao')\""));
    assert.ok(trace.code.react18.includes("onClick={() => handleNavigate('autorizacao')}"));
  });

  await t.test("M3.3 - Matriz de paridade semântica comprovada entre Vanilla, Angular 18 e React 18+", () => {
    const screen = proto.screens.autorizacao;
    const v = generateScreenCode("vanilla", screen, proto);
    const a = generateScreenCode("angular18", screen, proto);
    const r = generateScreenCode("react18", screen, proto);

    const testNodeIds = ["root-autorizacao", "node-aut-header", "node-btn-concluir-disp"];
    for (const nid of testNodeIds) {
      assert.ok(v.html.includes(nid), `Vanilla deve conter nó ${nid}`);
      assert.ok(a.html.includes(nid), `Angular deve conter nó ${nid}`);
      assert.ok(r.tsx.includes(nid), `React deve conter nó ${nid}`);
    }
  });

  await t.test("M3.4 - Piloto funcional DIS atende 100% às regras do schema v2 com 3 telas clínicas", () => {
    const validation = validatePrototypeDefinition(proto);
    assert.equal(validation.valid, true, `Validação falhou: ${validation.errors.join(", ")}`);

    // Valida encadeamento do fluxo
    const btn1 = proto.screens.home.nodes["node-btn-nova-rx"];
    assert.equal(resolveNodeNavigation(proto, btn1).id, "prescricao");

    const btn2 = proto.screens.prescricao.nodes["node-btn-avancar-aut"];
    assert.equal(resolveNodeNavigation(proto, btn2).id, "autorizacao");

    const btn3 = proto.screens.autorizacao.nodes["node-btn-concluir-disp"];
    assert.equal(resolveNodeNavigation(proto, btn3).id, "home");
  });

  await t.test("M3.5 - Governança arquitetural: anti-monólito (< 250-300 linhas) e ausência de emojis", () => {
    const serviceFiles = [
      "ui/server/services/prototype-schema.service.js",
      "ui/server/services/prototype-state.service.js",
      "ui/server/services/prototype-validator.service.js",
      "ui/server/services/prototype-semantic-parser.service.js",
      "ui/server/services/prototype-screen-decomposer.service.js",
      "ui/server/services/prototype-reconstructor.service.js",
      "ui/server/services/prototype-sandbox-renderer.service.js",
      "ui/server/services/prototype-codegen-vanilla.service.js",
      "ui/server/services/prototype-codegen-angular.service.js",
      "ui/server/services/prototype-codegen-react.service.js",
      "ui/server/services/prototype-codegen.factory.js",
      "ui/server/services/prototype-studio.service.js",
      "ui/server/services/prototype-traceability.service.js",
    ];

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

    for (const rel of serviceFiles) {
      const full = path.join(REPO_ROOT, rel);
      assert.ok(fs.existsSync(full), `Arquivo ${rel} deve existir`);
      const content = fs.readFileSync(full, "utf8");
      const lines = content.split("\n").length;
      assert.ok(lines <= 300, `Arquivo ${rel} tem ${lines} linhas (excedeu limite estrito de 300)`);
      assert.equal(emojiRegex.test(content), false, `Arquivo ${rel} não deve conter emojis`);
    }
  });
});
