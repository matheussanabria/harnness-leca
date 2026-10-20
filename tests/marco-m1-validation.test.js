import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { getComponent, listRegistryComponents } from "../ui/server/services/design-registry.service.js";
import { renderComponentPreview } from "../ui/server/services/design-preview.service.js";

const projectDir = path.resolve(process.cwd(), "projects/saude-dispensacao");
const dsDir = path.join(projectDir, "design", "ds");

test("EP-12.12: Homologação do Marco M1 (Extração Confiável de Componentes)", async (t) => {
  const components = listRegistryComponents(projectDir);
  const expectedIds = ["dis.annotation-list", "dis.accordion", "dis.button", "dis.icon"];

  await t.test("todos os componentes fundamentais do Marco M1 estão registrados", () => {
    assert.ok(components.length >= 4, `Deve conter ao menos 4 componentes (encontrados: ${components.length})`);
    for (const id of expectedIds) {
      const comp = getComponent(projectDir, id);
      assert.ok(comp, `Componente '${id}' deve estar presente no Registry`);
      assert.equal(comp.id, id);
      assert.ok(comp.name, `Componente '${id}' deve possuir nome legível`);
    }
  });

  await t.test("todos os arquivos físicos declarados existem e atendem ao teto de 250 linhas", async () => {
    for (const id of expectedIds) {
      const comp = getComponent(projectDir, id);
      const vanilla = comp.implementations?.vanilla;
      assert.ok(vanilla, `Componente '${id}' deve possuir implementação vanilla`);

      const compFolder = id.split(".")[1];
      for (const file of vanilla.files) {
        const filePath = path.join(dsDir, "components", compFolder, file);
        const content = await fs.readFile(filePath, "utf8");
        const lines = content.split("\n").length;
        assert.ok(lines <= 250, `Arquivo ${file} do componente ${id} não pode exceder 250 linhas (tem ${lines})`);
        
        // Regra de proibição estrita de emojis
        const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        assert.ok(!emojiRegex.test(content), `Arquivo ${file} do componente ${id} não pode conter emojis`);
      }
    }
  });

  await t.test("todos os tokens CSS utilizados existem nas folhas de estilo de tokens e temas", async () => {
    const tokensContent = await fs.readFile(path.join(dsDir, "tokens.css"), "utf8");
    const themeContent = await fs.readFile(path.join(dsDir, "theme.css"), "utf8");
    const allTokens = `${tokensContent}\n${themeContent}`;

    for (const id of expectedIds) {
      const comp = getComponent(projectDir, id);
      for (const token of comp.tokensUsed || []) {
        assert.ok(
          allTokens.includes(token),
          `Token '${token}' declarado no componente '${id}' deve existir em tokens.css ou theme.css`
        );
      }
    }
  });

  await t.test("grafo de dependências é coerente e sem ciclos", () => {
    const icon = getComponent(projectDir, "dis.icon");
    const button = getComponent(projectDir, "dis.button");
    const accordion = getComponent(projectDir, "dis.accordion");
    const annotationList = getComponent(projectDir, "dis.annotation-list");

    assert.deepEqual(icon.dependencies, [], "dis.icon deve ser nó folha");
    assert.ok(button.dependencies.includes("dis.icon"), "dis.button depende de dis.icon");
    assert.ok(accordion.dependencies.includes("dis.icon"), "dis.accordion depende de dis.icon");
    assert.ok(annotationList.dependencies.includes("dis.accordion"), "dis.annotation-list depende de dis.accordion");
    assert.ok(annotationList.dependencies.includes("dis.icon"), "dis.annotation-list depende de dis.icon");
  });

  await t.test("todos os componentes geram preview sandbox íntegro", () => {
    for (const id of expectedIds) {
      const html = renderComponentPreview(projectDir, id);
      assert.ok(html.includes("<!DOCTYPE html>"), `HTML do preview de ${id} deve conter <!DOCTYPE html>`);
      assert.ok(html.includes('id="preview-root"'), `HTML do preview de ${id} deve conter preview-root`);
      assert.ok(!html.includes('class="undefined"'), `HTML do preview de ${id} não deve ter class="undefined"`);
      assert.ok(!html.includes("<undefined>"), `HTML do preview de ${id} não deve conter tags <undefined>`);
    }
  });
});
