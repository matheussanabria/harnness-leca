import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createPrototypeDefinition,
  addScreen,
  addNode,
  buildTreeFromMap,
  flattenTreeToMap,
  resolveNodeNavigation,
} from "../ui/server/services/prototype-schema.service.js";

test("EP-12.13 & EP-12.14: Prototype Schema V2, Slots e Navegação", async (t) => {
  await t.test("JSON Schema oficial v2 existe e é parseável", async () => {
    const schemaPath = path.resolve(process.cwd(), "schemas/prototype-v2.schema.json");
    const raw = await fs.readFile(schemaPath, "utf8");
    const schema = JSON.parse(raw);
    assert.equal(schema.title, "PrototypeDefinitionV2");
    assert.ok(schema.properties.metadata);
    assert.ok(schema.properties.screens);
    assert.ok(schema.definitions.PrototypeNode);
  });

  await t.test("cria definição válida e adiciona telas", () => {
    const proto = createPrototypeDefinition({
      id: "dis-paciente",
      title: "Fluxo de Dispensação",
    });

    assert.equal(proto.metadata.id, "dis-paciente");
    assert.equal(proto.metadata.schemaVersion, "2.0.0");

    const screenHome = addScreen(proto, {
      id: "home",
      title: "Tela Inicial",
    });

    assert.equal(screenHome.id, "home");
    assert.ok(screenHome.nodes[screenHome.rootNodeId]);
    assert.equal(proto.screens.home.title, "Tela Inicial");
  });

  await t.test("adiciona nós filhos com props e slots nomeados", () => {
    const proto = createPrototypeDefinition({ id: "dis-paciente", title: "DIS" });
    const screen = addScreen(proto, { id: "home", title: "Home" });

    // Adiciona botão na raiz da tela
    const btnNode = addNode(screen, {
      id: "btn-salvar",
      componentId: "dis.button",
      props: { label: "Salvar Dados", emphasis: "primary" },
      events: {
        click: { type: "navigate", target: "detalhes" }
      }
    });

    assert.equal(btnNode.id, "btn-salvar");
    assert.ok(screen.nodes[screen.rootNodeId].children.includes("btn-salvar"));

    // Adiciona modal com slot "footer"
    const modalNode = addNode(screen, {
      id: "modal-confirm",
      componentId: "dis.modal",
      props: { title: "Confirmar" }
    });

    const btnModal = addNode(screen, {
      id: "btn-ok",
      componentId: "dis.button",
      props: { label: "OK" }
    }, "modal-confirm", "footer");

    assert.ok(screen.nodes["modal-confirm"].slotTargets.footer.includes("btn-ok"));
  });

  await t.test("converte entre mapa O(1) e árvore aninhada bidirecionalmente", () => {
    const proto = createPrototypeDefinition({ id: "p1", title: "P1" });
    const screen = addScreen(proto, { id: "s1", title: "S1" });

    addNode(screen, {
      id: "card-1",
      componentId: "dis.card",
      props: { title: "Card Exemplo" }
    });

    addNode(screen, {
      id: "acc-1",
      componentId: "dis.accordion",
      props: { items: [] }
    }, "card-1");

    // Monta árvore a partir do mapa
    const tree = buildTreeFromMap(screen.rootNodeId, screen.nodes);
    assert.equal(tree.id, screen.rootNodeId);
    assert.equal(tree.children[0].id, "card-1");
    assert.equal(tree.children[0].children[0].id, "acc-1");

    // Achatamento de volta para o mapa O(1)
    const flattened = flattenTreeToMap(tree);
    assert.ok(flattened[screen.rootNodeId]);
    assert.ok(flattened["card-1"]);
    assert.ok(flattened["acc-1"]);
    assert.deepEqual(flattened["card-1"].children, ["acc-1"]);
  });

  await t.test("resolve navegação de nó entre telas", () => {
    const proto = createPrototypeDefinition({ id: "p1", title: "P1" });
    const s1 = addScreen(proto, { id: "s1", title: "Tela 1" });
    addScreen(proto, { id: "s2", title: "Tela 2" });

    const navBtn = addNode(s1, {
      id: "btn-ir",
      componentId: "dis.button",
      events: {
        click: { type: "navigate", target: "s2" }
      }
    });

    const targetScreen = resolveNodeNavigation(proto, navBtn, "click");
    assert.ok(targetScreen);
    assert.equal(targetScreen.id, "s2");
    assert.equal(targetScreen.title, "Tela 2");

    const noNav = resolveNodeNavigation(proto, navBtn, "dblclick");
    assert.equal(noNav, null);
  });
});
