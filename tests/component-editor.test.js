// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  sanitizeText,
  sanitizeClass,
  sanitizeStyleToken,
  previewEdit,
  applyEdit,
  undoEdit,
} = require("../ui/server/services/component-editor.service");

test("component-editor: sanitização de texto, classes e tokens", () => {
  // 1. Texto puro
  assert.equal(sanitizeText("Olá Mundo & Cia"), "Olá Mundo &amp; Cia");
  assert.equal(sanitizeText("Tag <b>forte</b>"), "Tag &lt;b&gt;forte&lt;/b&gt;");
  assert.throws(() => sanitizeText("Valor {{ item.name }}"), /interpolação Angular/);
  assert.throws(() => sanitizeText("<script>alert(1)</script>"), /tags perigosas/);

  // 2. Classes CSS
  assert.equal(sanitizeClass("btn btn-primary ds-badge--warning"), "btn btn-primary ds-badge--warning");
  assert.throws(() => sanitizeClass("btn; drop-table"), /caracteres proibidos/);
  assert.throws(() => sanitizeClass("btn{color:red}"), /caracteres proibidos/);

  // 3. Tokens SCSS/CSS
  const tok = sanitizeStyleToken("color", "var(--primary-interactive)");
  assert.equal(tok.property, "color");
  assert.equal(tok.value, "var(--primary-interactive)");
  assert.throws(() => sanitizeStyleToken("color", "red; background: black;"), /comandos proibidos/);
  assert.throws(() => sanitizeStyleToken("bg", "@import 'hack';"), /comandos proibidos/);
});

test("component-editor: previewEdit gera diff unificado e fingerprint", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-editor-preview-"));
  try {
    const htmlFile = path.join(tmpDir, "card.component.html");
    fs.writeFileSync(htmlFile, '<div class="card">\n  <span class="badge">Texto Antigo</span>\n</div>\n');

    const preview = previewEdit(tmpDir, {
      file: "card.component.html",
      target: { tag: "span", text: "Texto Antigo", attributes: { class: "badge" } },
      change: { type: "text", value: "Texto Novo" },
    });

    assert.equal(preview.ok, true);
    assert.ok(preview.diff.includes("-  <span class=\"badge\">Texto Antigo</span>"));
    assert.ok(preview.diff.includes("+  <span class=\"badge\">Texto Novo</span>"));
    assert.ok(preview.fingerprint);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("component-editor: applyEdit grava atomicamente e undoEdit restaura perfeitamente", () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "harness-repo-"));
  const tmpProj = fs.mkdtempSync(path.join(os.tmpdir(), "harness-proj-"));

  try {
    const htmlFile = path.join(tmpRepo, "badge.component.html");
    const originalContent = '<div class="box">\n  <span class="badge">Status Inicial</span>\n</div>\n';
    fs.writeFileSync(htmlFile, originalContent);

    // 1. Gera preview para capturar fingerprint
    const preview = previewEdit(tmpRepo, {
      file: "badge.component.html",
      target: { tag: "span", text: "Status Inicial" },
      change: { type: "text", value: "Status Atualizado" },
    });
    assert.equal(preview.ok, true);

    // 2. Aplica alteração
    const applied = applyEdit(tmpRepo, tmpProj, {
      file: "badge.component.html",
      target: { tag: "span", text: "Status Inicial" },
      change: { type: "text", value: "Status Atualizado" },
      fingerprint: preview.fingerprint,
    });
    assert.equal(applied.ok, true);
    assert.ok(applied.undoToken);

    // Confirma que o arquivo no disco foi atualizado
    const updated = fs.readFileSync(htmlFile, "utf8");
    assert.ok(updated.includes("Status Atualizado"));

    // 3. Testa trava 409 quando o fingerprint difere
    assert.throws(
      () =>
        applyEdit(tmpRepo, tmpProj, {
          file: "badge.component.html",
          target: { tag: "span", text: "Status Atualizado" },
          change: { type: "text", value: "Outra Coisa" },
          fingerprint: "hash_invalido:123",
        }),
      (err) => err.code === "CONFLICT_409"
    );

    // 4. Executa Undo
    const undone = undoEdit(tmpProj, applied.undoToken);
    assert.equal(undone.ok, true);
    assert.equal(fs.readFileSync(htmlFile, "utf8"), originalContent);
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
    fs.rmSync(tmpProj, { recursive: true, force: true });
  }
});

test("component-editor: adiciona e remove classes CSS com segurança", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-class-edit-"));
  try {
    const htmlFile = path.join(tmpDir, "btn.component.html");
    fs.writeFileSync(htmlFile, '<button class="btn btn-secondary">Ação</button>');

    // Adiciona classe
    const pAdd = previewEdit(tmpDir, {
      file: "btn.component.html",
      target: { tag: "button", text: "Ação" },
      change: { type: "class", action: "add-class", value: "ds-btn--primary" },
    });
    assert.equal(pAdd.ok, true);
    assert.ok(pAdd.newContent.includes('class="btn btn-secondary ds-btn--primary"'));

    // Remove classe
    const pRemove = previewEdit(tmpDir, {
      file: "btn.component.html",
      target: { tag: "button", text: "Ação" },
      change: { type: "class", action: "remove-class", value: "btn-secondary" },
    });
    assert.equal(pRemove.ok, true);
    assert.ok(pRemove.newContent.includes('class="btn"'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("HTTP API: rotas de edição direta (preview, apply, undo) funcionam via servidor", async () => {
  const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-http-edit-root-"));
  const MOCK_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "harness-http-edit-repo-"));
  const origHarnessRoot = process.env.HARNESS_ROOT;
  process.env.HARNESS_ROOT = TMP_ROOT;

  try {
    const projDir = path.join(TMP_ROOT, "projects", "edit-demo");
    fs.mkdirSync(projDir, { recursive: true });
    fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "edit-demo\n");

    fs.writeFileSync(
      path.join(projDir, "mcp.json"),
      JSON.stringify({ repo: MOCK_REPO, servidores: [] })
    );

    const compDir = path.join(MOCK_REPO, "src", "app");
    fs.mkdirSync(compDir, { recursive: true });
    const htmlPath = path.join(compDir, "badge.html");
    fs.writeFileSync(htmlPath, '<h1>Original</h1>');

    const { createServer } = require("../ui/server");
    const server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      // 1. Preview
      const resPreview = await fetch(`${base}/api/project/edit-demo/inspect/edit/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({
          file: "src/app/badge.html",
          target: { tag: "h1", text: "Original" },
          change: { type: "text", value: "Modificado" },
        }),
      });
      assert.equal(resPreview.status, 200);
      const dataPrev = await resPreview.json();
      assert.equal(dataPrev.ok, true);
      assert.ok(dataPrev.diff.includes("-<h1>Original</h1>"));
      assert.ok(dataPrev.diff.includes("+<h1>Modificado</h1>"));
      assert.ok(dataPrev.fingerprint);

      // 2. Apply
      const resApply = await fetch(`${base}/api/project/edit-demo/inspect/edit/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({
          file: "src/app/badge.html",
          target: { tag: "h1", text: "Original" },
          change: { type: "text", value: "Modificado" },
          fingerprint: dataPrev.fingerprint,
        }),
      });
      assert.equal(resApply.status, 200);
      const dataApply = await resApply.json();
      assert.equal(dataApply.ok, true);
      assert.ok(dataApply.undoToken);

      // Confirma alteração no arquivo
      assert.equal(fs.readFileSync(htmlPath, "utf8"), "<h1>Modificado</h1>");

      // 3. Undo
      const resUndo = await fetch(`${base}/api/project/edit-demo/inspect/edit/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ undoToken: dataApply.undoToken }),
      });
      assert.equal(resUndo.status, 200);
      assert.equal(fs.readFileSync(htmlPath, "utf8"), "<h1>Original</h1>");
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

test("component-editor: teste de regressão com template real do dispensacao (Entregas liberadas)", () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "harness-dispensacao-reg-"));
  try {
    const htmlContent = `@if (erro(); as e) {
  <ngb-alert [type]="e.tipo" (closed)="erro.set(null)">{{ e.mensagem }}</ngb-alert>
}

@if (carregando()) {
  <p class="text-muted">Carregando entregas liberadas...</p>
} @else {
  @if (itensInelegiveis().length > 0) {
    <ngb-alert type="warning" [dismissible]="false">
      @for (item of itensInelegiveis(); track item.idEntregaPrevista) {
        <div>{{ item.nomeMedicamento }}: não está mais disponível para entrega ({{ item.motivoInelegibilidade }}).</div>
      }
    </ngb-alert>
  }

  @if (itens().length === 0) {
    <p class="text-muted">Nenhuma entrega liberada selecionada está disponível.</p>
  } @else {
    <h2 class="dis-section-title">Entregas liberadas</h2>
    @for (item of itens(); track item.idEntregaPrevista) {
      <entrega-liberada-calculo-card [cns]="cns" [item]="item" (estadoAlterado)="onEstadoAlterado($event)" />
    }

    <dados-responsavel-retirada [cnsPaciente]="cns" (resultado)="onResponsavelAlterado($event)" />

    <div class="dis-actions">
      <button type="button" class="btn btn-outline-primary" (click)="voltar()">
        <fa-icon class="ds-icon" [icon]="icones.voltar" aria-hidden="true" /> Voltar
      </button>
      <button type="button" class="btn btn-primary" [disabled]="!podeEntregar() || enviando()" (click)="confirmar()">
        <fa-icon class="ds-icon" [icon]="icones.entregar" aria-hidden="true" /> Entregar
      </button>
    </div>
  }
}
`;
    const relHtml = "entregas-liberadas.component.html";
    fs.writeFileSync(path.join(tmpRepo, relHtml), htmlContent);

    // Simula o payload capturado pela ponte com atributos de runtime do Angular
    const target = {
      tag: "h2",
      text: "Entregas liberadas",
      attributes: {
        class: "dis-section-title ng-star-inserted",
        "_ngcontent-ng-c198273": "",
        "_nghost-ng-c198273": "",
      },
      classes: ["dis-section-title", "ng-star-inserted"],
      domPath: "div.dis-container > h2.dis-section-title",
    };

    const preview = previewEdit(tmpRepo, {
      file: relHtml,
      target,
      change: { type: "text", value: "Liberado para entrega" },
    });

    assert.equal(preview.ok, true);
    assert.ok(preview.diff, "Diff deve ser gerado com sucesso");

    // Valida que o diff possui exatamente uma linha removida e uma adicionada
    const diffLines = preview.diff.split("\n");
    const removedLines = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    const addedLines = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    assert.equal(removedLines.length, 1, "Deve conter exatamente uma linha removida");
    assert.equal(addedLines.length, 1, "Deve conter exatamente uma linha adicionada");

    assert.equal(removedLines[0], '-    <h2 class="dis-section-title">Entregas liberadas</h2>');
    assert.equal(addedLines[0], '+    <h2 class="dis-section-title">Liberado para entrega</h2>');
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
});
