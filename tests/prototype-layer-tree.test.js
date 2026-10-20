// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { initLayerTree, selectLayerNode, renderTree } from "../ui/public/js/modules/prototype-layer-tree.js";

const REPO_ROOT = path.resolve(".");
const LAYER_TREE_PATH = path.join(REPO_ROOT, "ui", "public", "js", "modules", "prototype-layer-tree.js");

function createMockContainer() {
  let inner = "";
  return {
    get innerHTML() { return inner; },
    set innerHTML(val) { inner = val; },
    querySelector(sel) {
      if (sel === "#layerSearchInput") return null;
      if (sel === "#btnClearLayerSearch") return null;
      if (sel === ".layer-item-row.selected") return { scrollIntoView: () => {} };
      return null;
    },
    querySelectorAll(sel) {
      return [];
    },
  };
}

test("EP-12.23: Inspetor de Árvore com Seleção Bidirecional (prototype-layer-tree.js)", async (t) => {
  await t.test("módulo cumpre o teto estrito de 250 linhas e não possui emojis", () => {
    assert.ok(fs.existsSync(LAYER_TREE_PATH));
    const content = fs.readFileSync(LAYER_TREE_PATH, "utf8");
    const lines = content.split("\n").length;
    assert.ok(lines <= 250, `Arquivo com ${lines} linhas (limite 250)`);

    // Proibição estrita de emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
    assert.equal(emojiRegex.test(content), false, "Não deve conter emojis no código");
  });

  await t.test("renderiza nós com nodeId v2 canônico e classes FontAwesome", () => {
    const mockTree = [
      {
        nodeId: "node-header",
        tag: "header",
        category: "nav",
        displayName: "Cabeçalho Principal",
        children: [
          {
            nodeId: "node-btn-salvar",
            tag: "button",
            category: "action",
            displayName: "Salvar Registro",
            children: [],
          },
        ],
      },
    ];

    const container = createMockContainer();
    initLayerTree(mockTree, container, () => {}, () => {}, () => {});

    assert.ok(container.innerHTML.includes('data-node-id="node-header"'));
    assert.ok(container.innerHTML.includes("fa-solid fa-compass"));
    assert.ok(container.innerHTML.includes("Cabeçalho Principal"));
    assert.ok(container.innerHTML.includes("Salvar Registro"));
    assert.ok(container.innerHTML.includes("fa-solid fa-hand-pointer"));
  });

  await t.test("selectLayerNode marca o nó como selecionado no container", () => {
    const mockTree = [
      {
        nodeId: "node-1",
        tag: "div",
        category: "box",
        displayName: "Container 1",
        children: [
          {
            nodeId: "node-2",
            tag: "span",
            category: "text",
            displayName: "Texto Filho",
            children: [],
          },
        ],
      },
    ];

    const container = createMockContainer();
    initLayerTree(mockTree, container, () => {}, () => {}, () => {});
    selectLayerNode("node-2", container);

    assert.ok(container.innerHTML.includes('data-node-id="node-2"'));
    assert.ok(container.innerHTML.includes("selected"));
  });
});
