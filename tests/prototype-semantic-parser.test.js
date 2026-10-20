import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveComponentId,
  parseAttributes,
  parseSemanticNodes,
} from "../ui/server/services/prototype-semantic-parser.service.js";

test("EP-12.17: Pipeline de Parsing Semântico", async (t) => {
  await t.test("resolveComponentId mapeia globais para IDs canônicos", () => {
    assert.equal(resolveComponentId("DS.AnnotationList"), "dis.annotation-list");
    assert.equal(resolveComponentId("DS.Button"), "dis.button");
    assert.equal(resolveComponentId("DS.Accordion"), "dis.accordion");
    assert.equal(resolveComponentId("DS.CustomWidget"), "dis.custom-widget");
  });

  await t.test("parseAttributes extrai props estáticas e bindings dinâmicos", () => {
    const rawAttrs = 'items="{{notes}}" default-open-index="0" show-header="true" title="Notas"';
    const { props, bindings } = parseAttributes(rawAttrs);

    assert.equal(props.defaultOpenIndex, 0);
    assert.equal(props.showHeader, true);
    assert.equal(props.title, "Notas");
    assert.ok(bindings.items);
    assert.equal(bindings.items.stateKey, "notes");
  });

  await t.test("parseSemanticNodes extrai nós a partir de tags x-import reais", () => {
    const snippet = `
      <div class="dis-shell">
        <x-import component-from-global-scope="DS.Button" label="Salvar" emphasis="primary"></x-import>
        <x-import component-from-global-scope="DS.AnnotationList" items="{{notes}}" default-open-index="0"></x-import>
      </div>
    `;

    const nodes = parseSemanticNodes(snippet, "dis-node");
    assert.equal(nodes.length, 2);

    assert.equal(nodes[0].id, "dis-node-1");
    assert.equal(nodes[0].componentId, "dis.button");
    assert.equal(nodes[0].props.label, "Salvar");
    assert.equal(nodes[0].props.emphasis, "primary");

    assert.equal(nodes[1].id, "dis-node-2");
    assert.equal(nodes[1].componentId, "dis.annotation-list");
    assert.equal(nodes[1].bindings.items.stateKey, "notes");
    assert.equal(nodes[1].props.defaultOpenIndex, 0);
  });
});
