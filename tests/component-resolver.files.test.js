// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  normalizeComponentName,
  resolveComponent,
  readComponentFile,
} = require("../ui/server/services/component-resolver.service");

test("resolveComponent: suporte a seletor, styles inline, inexistente e nomes maliciosos", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-inspect-test-"));
  try {
    const appDir = path.join(tmpDir, "src", "app");
    fs.mkdirSync(appDir, { recursive: true });

    const tsFile = path.join(appDir, "combo.component.ts");
    const htmlFile = path.join(appDir, "combo.component.html");
    const cssFile = path.join(appDir, "combo.component.css");

    fs.writeFileSync(
      tsFile,
      `
import { Component } from '@angular/core';
@Component({
  selector: 'app-combo',
  templateUrl: './combo.component.html',
  styleUrls: ['./combo.component.css'],
  styles: ['p { margin: 0; }']
})
export class ComboComponent {}
`
    );
    fs.writeFileSync(htmlFile, "<p>Combo Body</p>");
    fs.writeFileSync(cssFile, "p { color: green; }");

    // 1. Busca por nome da classe
    const byClass = resolveComponent(tmpDir, "ComboComponent");
    assert.equal(byClass.found, true);
    assert.equal(byClass.selector, "app-combo");
    assert.equal(byClass.files.html.path, "src/app/combo.component.html");
    assert.equal(byClass.files.styles[0].path, "src/app/combo.component.css");
    assert.deepEqual(byClass.files.inlineStyles, ["p { margin: 0; }"]);

    // 2. Busca por seletor
    const bySelector = resolveComponent(tmpDir, "app-combo");
    assert.equal(bySelector.found, true);
    assert.equal(bySelector.className, "ComboComponent");

    // 3. Componente inexistente
    const notFound = resolveComponent(tmpDir, "InexistenteComponent");
    assert.equal(notFound.found, false);

    // 4. Validação estrita de nomes maliciosos
    assert.throws(() => resolveComponent(tmpDir, "../Malicioso"), /Nome de componente inválido/);
    assert.throws(() => resolveComponent(tmpDir, "Comp; drop table"), /Nome de componente inválido/);
    assert.throws(() => resolveComponent(tmpDir, "comp.*"), /Nome de componente inválido/);
    assert.throws(() => resolveComponent(tmpDir, "comp(1)"), /Nome de componente inválido/);
    assert.throws(() => resolveComponent(tmpDir, ""), /Nome de componente inválido/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("resolveComponent: normalização de prefixos _ e ɵ emitidos pelo esbuild e busca resiliente", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-prefix-test-"));
  try {
    const appDir = path.join(tmpDir, "src", "app");
    fs.mkdirSync(appDir, { recursive: true });

    const tsFile = path.join(appDir, "dispensation-item.component.ts");
    fs.writeFileSync(
      tsFile,
      `
import { Component } from '@angular/core';
@Component({
  selector: 'ds-dispensation-item',
  templateUrl: './dispensation-item.component.html'
})
export class DsDispensationItemComponent {}
`
    );
    fs.writeFileSync(path.join(appDir, "dispensation-item.component.html"), "<div>Item</div>");

    // 1. Testa normalizeComponentName
    assert.equal(normalizeComponentName("_DsDispensationItemComponent"), "DsDispensationItemComponent");
    assert.equal(normalizeComponentName("ɵDsDispensationItemComponent"), "DsDispensationItemComponent");
    assert.equal(normalizeComponentName("__ɵDsDispensationItemComponent"), "DsDispensationItemComponent");
    assert.equal(normalizeComponentName("DsDispensationItemComponent"), "DsDispensationItemComponent");

    // 2. Busca com prefixo '_' emitido pelo esbuild
    const resUnderscore = resolveComponent(tmpDir, "_DsDispensationItemComponent");
    assert.equal(resUnderscore.found, true);
    assert.equal(resUnderscore.className, "DsDispensationItemComponent");
    assert.equal(resUnderscore.selector, "ds-dispensation-item");

    // 3. Busca com prefixo 'ɵ' do Angular
    const resTheta = resolveComponent(tmpDir, "ɵDsDispensationItemComponent");
    assert.equal(resTheta.found, true);
    assert.equal(resTheta.className, "DsDispensationItemComponent");

    // 4. Busca com nome normalizado exato
    const resExact = resolveComponent(tmpDir, "DsDispensationItemComponent");
    assert.equal(resExact.found, true);
    assert.equal(resExact.className, "DsDispensationItemComponent");

    // 5. Componente inexistente retorna found: false com nome limpo
    const resNotFound = resolveComponent(tmpDir, "_ComponenteInexistente");
    assert.equal(resNotFound.found, false);
    assert.equal(resNotFound.className, "ComponenteInexistente");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("readComponentFile: segurança estrita de confinamento contra todos os vetores", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-read-sec-"));
  try {
    const safeFile = path.join(tmpDir, "src", "safe.html");
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(safeFile, "<p>Conteúdo seguro</p>");

    // Arquivo grande (> 500 KB)
    const largeFile = path.join(tmpDir, "src", "huge.bin");
    fs.writeFileSync(largeFile, Buffer.alloc(501 * 1024, "a"));

    // Arquivos em pastas ignoradas
    fs.mkdirSync(path.join(tmpDir, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "node_modules", "pkg", "index.js"), "module.exports = {}");

    fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".git", "config"), "[core]");

    fs.mkdirSync(path.join(tmpDir, ".angular"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".angular", "cache.json"), "{}");

    fs.mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "dist", "bundle.js"), "alert(1)");

    // Arquivos de ambiente (.env*)
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "SECRET=456");

    // Leitura válida
    const res = readComponentFile(tmpDir, "src/safe.html");
    assert.equal(res.content, "<p>Conteúdo seguro</p>");

    // Função auxiliar para testar erro e garantir que NÃO vaza o caminho real da máquina
    const assertBlocked = (relPath, expectedPattern) => {
      try {
        readComponentFile(tmpDir, relPath);
        assert.fail(`Deveria ter bloqueado o caminho: ${relPath}`);
      } catch (err) {
        assert.match(err.message, expectedPattern);
        assert.ok(!err.message.includes(tmpDir), `Mensagem vazou o caminho da máquina: ${err.message}`);
      }
    };

    // 1. Travessia com .. (/ e \)
    assertBlocked("../../.env", /Acesso negado/);
    assertBlocked("..\\..\\.env", /Acesso negado/);
    assertBlocked("src/../../outside.txt", /Acesso negado/);

    // 2. Caminhos absolutos (Windows C:\ ou /, ou UNC \\)
    assertBlocked("C:\\Windows\\System32\\drivers\\etc\\hosts", /Acesso negado/);
    assertBlocked("/etc/passwd", /Acesso negado/);
    assertBlocked("\\\\server\\share\\data", /Acesso negado/);

    // 3. Byte nulo
    assertBlocked("src/safe\0.html", /Caminho contém caractere nulo proibido/);

    // 4. Travessia codificada com %2e
    assertBlocked("%2e%2e/.env", /Acesso negado.*%2e/);
    assertBlocked("src/%2E%2E/secret.key", /Acesso negado.*%2e/);

    // 5. Arquivo > 500 KB
    assertBlocked("src/huge.bin", /Arquivo excede o tamanho máximo permitido \(500 KB\)/);

    // 6. Pastas ignoradas
    assertBlocked("node_modules/pkg/index.js", /Acesso negado: leitura em pasta protegida \(node_modules\)/);
    assertBlocked(".git/config", /Acesso negado: leitura em pasta protegida \(\.git\)/);
    assertBlocked(".angular/cache.json", /Acesso negado: leitura em pasta protegida \(\.angular\)/);
    assertBlocked("dist/bundle.js", /Acesso negado: leitura em pasta protegida \(dist\)/);

    // 7. Arquivos .env*
    assertBlocked(".env", /Acesso negado: leitura de arquivos de configuração \.env/);
    assertBlocked(".env.local", /Acesso negado: leitura de arquivos de configuração \.env/);

    // 8. Link simbólico dentro do repositório apontando para fora
    const outsideTarget = path.join(os.tmpdir(), "outside-secret.txt");
    fs.writeFileSync(outsideTarget, "super-secret");
    const symlinkPath = path.join(tmpDir, "src", "symlink-outside.txt");
    try {
      fs.symlinkSync(outsideTarget, symlinkPath);
      assertBlocked("src/symlink-outside.txt", /Acesso negado: link simbólico aponta para fora/);
    } catch (e) {
      // No Windows sem Developer Mode symlink pode lançar EPERM; ignora se o SO não permitir criar
      if (!String(e).includes("EPERM") && !String(e).includes("privilege")) {
        throw e;
      }
    } finally {
      try { fs.rmSync(outsideTarget, { force: true }); } catch {}
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

