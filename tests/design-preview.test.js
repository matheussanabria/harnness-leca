import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { renderComponentPreview } from "../ui/server/services/design-preview.service.js";
import { apiRegistryPreviewComponent } from "../ui/server/controllers/design-registry.controller.js";

const projectDir = path.resolve(process.cwd(), "projects/saude-dispensacao");

test("EP-12.11: Harness de Preview Isolado de Componentes", async (t) => {
  await t.test("renderComponentPreview gera HTML válido para dis.annotation-list", () => {
    const html = renderComponentPreview(projectDir, "dis.annotation-list");
    assert.ok(html.includes("<!DOCTYPE html>"), "Deve iniciar com doctype");
    assert.ok(html.includes("Preview: Lista de Anotações"), "Deve conter o título do componente");
    assert.ok(html.includes('id="preview-root"'), "Deve conter o root de montagem");
    assert.ok(html.includes("renderAnnotationList(root, props)"), "Deve invocar renderAnnotationList");
    assert.ok(html.includes("--primary-interactive"), "Deve incluir estilos e variáveis de tema");
  });

  await t.test("renderComponentPreview gera HTML válido para dis.accordion", () => {
    const html = renderComponentPreview(projectDir, "dis.accordion");
    assert.ok(html.includes("renderAccordion(root, props)"), "Deve invocar renderAccordion");
    assert.ok(html.includes("ds-accordion"), "Deve conter classes do accordion");
  });

  await t.test("renderComponentPreview gera HTML válido para dis.button e dis.icon", () => {
    const btnHtml = renderComponentPreview(projectDir, "dis.button");
    assert.ok(btnHtml.includes("renderButton(root, props)"), "Deve invocar renderButton");

    const iconHtml = renderComponentPreview(projectDir, "dis.icon");
    assert.ok(iconHtml.includes("renderIcon(root, props)"), "Deve invocar renderIcon");
  });

  await t.test("apiRegistryPreviewComponent responde 200 com text/html", async () => {
    let statusCode = 0;
    let headers = {};
    let body = "";

    const req = { url: "http://localhost/api/project/saude-dispensacao/design/registry/dis.button/preview" };
    const res = {
      writeHead(code, h) {
        statusCode = code;
        headers = h;
      },
      end(data) {
        body = data;
      }
    };

    await apiRegistryPreviewComponent({ req, res, params: ["saude-dispensacao", "dis.button"] });

    assert.equal(statusCode, 200);
    assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
    assert.ok(body.includes("Preview: Botão (dis.button)"));
  });
});
