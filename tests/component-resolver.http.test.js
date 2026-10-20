// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

test("HTTP API: rotas inspect/resolve e inspect/file aplicam regras de segurança e códigos de status", async () => {
  const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-inspect-http-"));
  const MOCK_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "harness-inspect-repo-"));
  const origHarnessRoot = process.env.HARNESS_ROOT;
  process.env.HARNESS_ROOT = TMP_ROOT;

  try {
    const projDir = path.join(TMP_ROOT, "projects", "inspect-demo");
    fs.mkdirSync(projDir, { recursive: true });
    fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "inspect-demo\n");

    // Configura mcp.json com o repo mock
    fs.writeFileSync(
      path.join(projDir, "mcp.json"),
      JSON.stringify({ repo: MOCK_REPO, servidores: [] })
    );

    // Cria arquivos do componente no repo mock
    const compDir = path.join(MOCK_REPO, "src", "app");
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(
      path.join(compDir, "card.component.ts"),
      `
import { Component } from '@angular/core';
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.css'
})
export class CardComponent {}
`
    );
    fs.writeFileSync(path.join(compDir, "card.component.html"), "<div>Card Body</div>");
    fs.writeFileSync(path.join(compDir, "card.component.css"), ".card { padding: 10px; }");

    // Cria arquivo grande > 500 KB no repo mock
    fs.writeFileSync(path.join(compDir, "huge.bin"), Buffer.alloc(501 * 1024, "x"));

    // Cria pasta node_modules e .env no repo mock
    fs.mkdirSync(path.join(MOCK_REPO, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(MOCK_REPO, "node_modules", "pkg", "test.js"), "console.log(1)");
    fs.writeFileSync(path.join(MOCK_REPO, ".env"), "TOKEN=abc");

    const { createServer } = require("../ui/server");
    const server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      // 1. Resolve com sucesso -> 200
      const resResolve = await fetch(`${base}/api/project/inspect-demo/inspect/resolve?component=CardComponent`);
      assert.equal(resResolve.status, 200);
      const dataResolve = await resResolve.json();
      assert.equal(dataResolve.found, true);
      assert.equal(dataResolve.className, "CardComponent");
      assert.equal(dataResolve.selector, "app-card");
      assert.equal(dataResolve.files.html.path, "src/app/card.component.html");

      // 2. Resolve componente inexistente -> 404
      const resNotFound = await fetch(`${base}/api/project/inspect-demo/inspect/resolve?component=NonExistent`);
      assert.equal(resNotFound.status, 404);

      // 3. Resolve nome malicioso -> 400
      const resMalicious = await fetch(`${base}/api/project/inspect-demo/inspect/resolve?component=${encodeURIComponent("../hack")}`);
      assert.equal(resMalicious.status, 400);

      // 4. Lê arquivo existente -> 200
      const resFile = await fetch(`${base}/api/project/inspect-demo/inspect/file?path=${encodeURIComponent("src/app/card.component.html")}`);
      assert.equal(resFile.status, 200);
      const dataFile = await resFile.json();
      assert.equal(dataFile.content, "<div>Card Body</div>");

      // 5. Tentativa de fuga de diretório ../../.env -> 403
      const resEscape = await fetch(`${base}/api/project/inspect-demo/inspect/file?path=${encodeURIComponent("../../.env")}`);
      assert.equal(resEscape.status, 403);
      const escapeData = await resEscape.json();
      assert.ok(!escapeData.error.includes(MOCK_REPO), "A resposta 403 não pode vazar caminhos da máquina");

      // 6. Tentativa de leitura de pasta protegida node_modules -> 403
      const resNodeModules = await fetch(`${base}/api/project/inspect-demo/inspect/file?path=${encodeURIComponent("node_modules/pkg/test.js")}`);
      assert.equal(resNodeModules.status, 403);

      // 7. Tentativa de leitura de arquivo .env -> 403
      const resEnv = await fetch(`${base}/api/project/inspect-demo/inspect/file?path=${encodeURIComponent(".env")}`);
      assert.equal(resEnv.status, 403);

      // 8. Arquivo que excede tamanho máximo permitido -> 400
      const resHuge = await fetch(`${base}/api/project/inspect-demo/inspect/file?path=${encodeURIComponent("src/app/huge.bin")}`);
      assert.equal(resHuge.status, 400);
      const hugeData = await resHuge.json();
      assert.match(hugeData.error, /Arquivo excede o tamanho máximo/);

      // 9. Lista componentes -> 200
      const resComponents = await fetch(`${base}/api/project/inspect-demo/inspect/components`);
      assert.equal(resComponents.status, 200);
      const dataComponents = await resComponents.json();
      assert.equal(dataComponents.ok, true);
      assert.equal(dataComponents.components.length, 1);
      assert.equal(dataComponents.components[0].className, "CardComponent");
    } finally {
      server.closeAllConnections();
      server.close();
    }
  } finally {
    process.env.HARNESS_ROOT = origHarnessRoot;
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    fs.rmSync(MOCK_REPO, { recursive: true, force: true });
  }
});
