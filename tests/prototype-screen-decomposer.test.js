import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanAndAnnotateHtml,
  decomposeIntoScreens,
} from "../ui/server/services/prototype-screen-decomposer.service.js";
import { parseSemanticNodes } from "../ui/server/services/prototype-semantic-parser.service.js";

test("EP-12.18: Decompositor de Telas e Anotação de data-node-id", async (t) => {
  await t.test("cleanAndAnnotateHtml substitui x-import por div anotada com data-node-id", () => {
    const raw = `
      <div class="dis-container">
        <x-import component-from-global-scope="DS.AnnotationList" items="{{notes}}"></x-import>
        <script src="support.js"></script>
      </div>
    `;

    const nodes = parseSemanticNodes(raw, "test-node");
    const clean = cleanAndAnnotateHtml(raw, nodes);

    assert.ok(clean.includes('data-node-id="test-node-1"'));
    assert.ok(clean.includes('data-component="dis.annotation-list"'));
    assert.ok(!clean.includes("<x-import"));
    assert.ok(!clean.includes("support.js"));
  });

  await t.test("decomposeIntoScreens estrutura mapa de telas e nós semânticos", () => {
    const raw = `
      <x-dc>
        <x-import component-from-global-scope="DS.Header" system-name="DIS"></x-import>
        <x-import component-from-global-scope="DS.AnnotationList" items="{{notes}}"></x-import>
      </x-dc>
    `;

    const result = decomposeIntoScreens(raw, "dis-fluxo");
    assert.ok(result.screens.home);
    assert.equal(result.screens.home.title, "Resumo do Paciente");
    assert.ok(result.screens.home.nodes["node-1"]);
    assert.ok(result.screens.home.nodes["node-2"]);
    assert.ok(result.screens.home.htmlContent.includes('data-node-id="node-1"'));
  });
});
