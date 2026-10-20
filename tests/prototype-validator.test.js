import test from "node:test";
import assert from "node:assert/strict";
import { validatePrototypeDefinition } from "../ui/server/services/prototype-validator.service.js";
import {
  createPrototypeDefinition,
  addScreen,
  addNode,
} from "../ui/server/services/prototype-schema.service.js";

test("EP-12.16: Validador de Schema e Integridade Referencial", async (t) => {
  await t.test("valida com sucesso uma definição de protótipo bem formada", () => {
    const proto = createPrototypeDefinition({
      id: "fluxo-teste",
      title: "Fluxo de Teste",
      defaultScreenId: "inicio",
    });

    const sInicio = addScreen(proto, { id: "inicio", title: "Início" });
    const sFim = addScreen(proto, { id: "fim", title: "Fim" });

    addNode(sInicio, {
      id: "btn-avancar",
      componentId: "dis.button",
      props: { label: "Avançar" },
      events: {
        click: { type: "navigate", target: "fim" }
      }
    });

    const result = validatePrototypeDefinition(proto);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  await t.test("rejeita protótipo sem metadata ou versão incompatível", () => {
    const res1 = validatePrototypeDefinition({});
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.some((e) => e.includes("metadata")));

    const res2 = validatePrototypeDefinition({
      metadata: { id: "x", schemaVersion: "1.0.0", title: "Old", defaultScreenId: "s1" },
      screens: {}
    });
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.some((e) => e.includes("schemaVersion")));
  });

  await t.test("detecta tela padrão inexistente", () => {
    const proto = createPrototypeDefinition({
      id: "p1",
      title: "P1",
      defaultScreenId: "inexistente",
    });
    addScreen(proto, { id: "outra", title: "Outra" });

    const result = validatePrototypeDefinition(proto);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("defaultScreenId: inexistente")));
  });

  await t.test("detecta referências a nós filhos inexistentes", () => {
    const proto = createPrototypeDefinition({ id: "p1", title: "P1", defaultScreenId: "s1" });
    const s1 = addScreen(proto, { id: "s1", title: "S1" });

    // Injeta filho fantasma no root
    s1.nodes[s1.rootNodeId].children.push("no-fantasma");

    const result = validatePrototypeDefinition(proto);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("no-fantasma")));
  });

  await t.test("detecta navegação para tela inexistente", () => {
    const proto = createPrototypeDefinition({ id: "p1", title: "P1", defaultScreenId: "s1" });
    const s1 = addScreen(proto, { id: "s1", title: "S1" });

    addNode(s1, {
      id: "btn-404",
      componentId: "dis.button",
      events: {
        click: { type: "navigate", target: "tela-fantasma" }
      }
    });

    const result = validatePrototypeDefinition(proto);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("tela inexistente 'tela-fantasma'")));
  });
});
