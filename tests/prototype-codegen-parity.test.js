// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateScreenCode, getSupportedFrameworks } from "../ui/server/services/prototype-codegen.factory.js";

const REPO_ROOT = path.resolve(".");
const SAUDE_DIR = path.join(REPO_ROOT, "projects", "saude-dispensacao");

test("EP-12.28: Matriz de Paridade Multiframework (Vanilla, Angular 18 e React 18+)", async (t) => {
  await t.test("factory reconhece os frameworks suportados e rejeita desconhecidos", () => {
    const list = getSupportedFrameworks();
    assert.ok(list.includes("vanilla"));
    assert.ok(list.includes("angular18"));
    assert.ok(list.includes("react18"));

    assert.throws(() => {
      generateScreenCode("vue-desconhecido", {}, {});
    }, /não suportado/);
  });

  await t.test("valida paridade semântica de tela clínica entre os 3 frameworks", () => {
    const protoPath = path.join(SAUDE_DIR, "design", "prototypes", "dis-modular", "proto.json");
    assert.ok(fs.existsSync(protoPath), "proto.json de dis-modular deve existir");
    const proto = JSON.parse(fs.readFileSync(protoPath, "utf8"));
    const screen = proto.screens.home;
    assert.ok(screen, "Tela home deve existir no protótipo");

    // 1. Gera nos 3 frameworks
    const vanillaOut = generateScreenCode("vanilla", screen, proto);
    const angularOut = generateScreenCode("angular18", screen, proto);
    const reactOut = generateScreenCode("react18", screen, proto);

    // 2. Paridade de nós: checa nós principais gerados na árvore a partir de root-home
    const sampleNodeIds = ["node-2", "node-3", "node-10"];
    for (const nodeId of sampleNodeIds) {
      if (screen.nodes[nodeId]) {
        assert.ok(
          vanillaOut.html.includes(`data-node-id="${nodeId}"`),
          `Vanilla deve conter ${nodeId}`
        );
        assert.ok(
          angularOut.html.includes(`data-node-id="${nodeId}"`),
          `Angular deve conter ${nodeId}`
        );
        assert.ok(
          reactOut.tsx.includes(`data-node-id="${nodeId}"`),
          `React deve conter ${nodeId}`
        );
      }
    }

    // 3. Paridade de tipagem e integridade do pacote gerado
    assert.equal(vanillaOut.framework, "vanilla");
    assert.ok(typeof vanillaOut.html === "string" && vanillaOut.html.length > 50);
    assert.ok(typeof vanillaOut.js === "string" && vanillaOut.js.includes("setupScreen"));

    assert.equal(angularOut.framework, "angular18");
    assert.ok(typeof angularOut.ts === "string" && angularOut.ts.includes("signal"));
    assert.ok(typeof angularOut.html === "string" && angularOut.html.length > 50);

    assert.equal(reactOut.framework, "react18");
    assert.ok(typeof reactOut.tsx === "string" && reactOut.tsx.includes("useState"));
  });

  await t.test("paridade de navegação declarativa entre as 3 saídas", () => {
    const mockScreen = {
      id: "teste-nav",
      rootNodeId: "root",
      nodes: {
        root: {
          id: "root",
          componentId: "layout.container",
          props: {},
          children: ["btn-ir"],
        },
        "btn-ir": {
          id: "btn-ir",
          componentId: "dis.button",
          props: { label: "Ir para Detalhes" },
          events: {
            click: { type: "navigate", target: "detalhes" },
          },
          children: [],
        },
      },
    };

    const v = generateScreenCode("vanilla", mockScreen, {});
    const a = generateScreenCode("angular18", mockScreen, {});
    const r = generateScreenCode("react18", mockScreen, {});

    // Vanilla usa data-action="goto:..."
    assert.ok(v.html.includes('data-action="goto:detalhes"'));
    // Angular usa (click)="onNavigate('...')"
    assert.ok(a.html.includes("(click)=\"onNavigate('detalhes')\""));
    // React usa onClick={() => handleNavigate('...')}
    assert.ok(r.tsx.includes("onClick={() => handleNavigate('detalhes')}"));

    // Label preservada em todos
    assert.ok(v.html.includes("Ir para Detalhes"));
    assert.ok(a.html.includes("Ir para Detalhes"));
    assert.ok(r.tsx.includes("Ir para Detalhes"));
  });
});
