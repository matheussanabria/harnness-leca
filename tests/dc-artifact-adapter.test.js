// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isDcArtifact,
  splitDcArtifact,
  validateDcParts,
  findRelativeAssets,
  verifyVendoredRuntime,
  writeDcInspection,
  readManifest,
  SUPPORT_SHA256,
} from "../ui/server/services/dc-artifact-adapter.service.js";

const REPO_ROOT = path.resolve(".");
const VENDOR_DIR = path.join(REPO_ROOT, "ui", "public", "js", "vendor", "dc-runtime");

const SAMPLE_DC = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><script src="./support.js"></script></head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div class="shell" style="padding:8px">
  <img src="uploads/logo.png" alt="logo">
  <sc-if value="{{ is.home }}"><p>Início {{ title }}</p></sc-if>
  <button onClick="{{ nav.estoque }}">Estoque</button>
</div>
<script type="text/x-dc" data-dc-script data-props="{&quot;startScreen&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;home&quot;,&quot;estoque&quot;]}}">
class Component extends DCLogic {
  state = { title: "Multimarcas" };
}
</script>
</x-dc>
</body></html>`;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dc-adapter-"));
}

test("EP-DC: adaptador de artefatos Claude Design (.dc.html)", async (t) => {
  await t.test("detecta .dc.html e recusa HTML estático", () => {
    assert.equal(isDcArtifact(SAMPLE_DC), true);
    assert.equal(isDcArtifact("<html><body><div>estático</div></body></html>"), false);
  });

  await t.test("separa helmet, template, lógica e props sem o script de lógica no template", () => {
    const parts = splitDcArtifact(SAMPLE_DC);
    assert.match(parts.helmet, /body\{margin:0\}/);
    assert.match(parts.template, /sc-if value="\{\{ is\.home \}\}"/);
    assert.doesNotMatch(parts.template, /text\/x-dc/);
    assert.match(parts.logic, /class Component extends DCLogic/);
    assert.deepEqual(parts.props.startScreen.options, ["home", "estoque"]);
    assert.equal(parts.warnings.length, 0);
  });

  await t.test("encontra a lógica quando ela vem depois de </x-dc> (formato do Claude Design)", () => {
    const outside = SAMPLE_DC.replace(/<script type="text\/x-dc"[\s\S]*?<\/script>\n<\/x-dc>/, "</x-dc>\n<script type=\"text/x-dc\" data-dc-script data-props=\"{}\">class Component extends DCLogic { state = {}; }</script>");
    const parts = splitDcArtifact(outside);
    assert.match(parts.logic, /class Component extends DCLogic/);
    assert.equal(parts.template.includes("text/x-dc"), false);
    assert.equal(parts.warnings.length, 0);
  });

  await t.test("bloqueia lógica com import/require e com </script", () => {
    const base = splitDcArtifact(SAMPLE_DC);
    const withImport = validateDcParts({ ...base, logic: 'import x from "./x.js";\nclass C {}' });
    assert.equal(withImport.ok, false);
    const withClose = validateDcParts({ ...base, logic: "const s = '</script>';" });
    assert.equal(withClose.ok, false);
  });

  await t.test("avisa sobre recursos externos fora da CSP e aceita Google Fonts", () => {
    const parts = splitDcArtifact(SAMPLE_DC.replace("<img src=\"uploads/logo.png\"", "<img src=\"https://cdn.exemplo.com/a.png\""));
    const result = validateDcParts(parts);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.includes("cdn.exemplo.com")));
    assert.ok(!result.warnings.some((w) => w.includes("fonts.googleapis.com")));
  });

  await t.test("encontra só referências relativas de assets", () => {
    const refs = findRelativeAssets('<img src="uploads/logo.png"><img src="https://x/y.png"><img src="data:image/png;base64,AA"><a href="#top">');
    assert.deepEqual(refs, ["uploads/logo.png"]);
  });

  await t.test("runtime vendorizado confere com os hashes aceitos", () => {
    const result = verifyVendoredRuntime(VENDOR_DIR);
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  });

  await t.test("runtime adulterado é recusado", () => {
    const dir = tmpDir();
    try {
      for (const f of ["react.production.min.js", "react-dom.production.min.js", "support.js"]) {
        fs.copyFileSync(path.join(VENDOR_DIR, f), path.join(dir, f));
      }
      fs.appendFileSync(path.join(dir, "support.js"), "\n// alterado\n");
      const result = verifyVendoredRuntime(dir);
      assert.equal(result.ok, false);
      assert.ok(result.problems.some((p) => p.includes("support.js")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await t.test("grava partes e manifesto, copia asset local e é idempotente pelo hash", () => {
    const root = tmpDir();
    try {
      const sourceDir = path.join(root, "design", "artifacts");
      fs.mkdirSync(path.join(sourceDir, "uploads"), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "uploads", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const protoDir = path.join(root, "design", "prototypes", "p1");
      fs.mkdirSync(protoDir, { recursive: true });
      const parts = splitDcArtifact(SAMPLE_DC);
      const sourceSha256 = "a".repeat(64);
      const meta = { sourceArtifact: "art-1", sourceFile: "design/artifacts/x.dc.html", sourceSha256, sourceDir };

      const first = writeDcInspection(protoDir, parts, meta);
      assert.equal(first.changed, true);
      assert.equal(first.manifest.inspectionFormat, 3);
      assert.equal(first.manifest.runtime.support_sha256, SUPPORT_SHA256);
      assert.deepEqual(first.manifest.screens, ["home", "estoque"]);
      assert.equal(first.manifest.defaultScreen, "home");
      assert.equal(first.manifest.assets.length, 1);
      assert.equal(fs.existsSync(path.join(protoDir, "dc", "assets", "uploads", "logo.png")), true);
      assert.equal(fs.existsSync(path.join(protoDir, "dc", "template.html")), true);
      assert.equal(fs.existsSync(path.join(protoDir, "dc", "logic.js")), true);
      assert.equal(fs.existsSync(path.join(protoDir, "dc", "helmet.html")), true);

      const second = writeDcInspection(protoDir, parts, meta);
      assert.equal(second.changed, false);

      const changed = writeDcInspection(protoDir, parts, { ...meta, sourceSha256: "b".repeat(64) });
      assert.equal(changed.changed, true);
      assert.equal(readManifest(protoDir).sourceSha256, "b".repeat(64));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test("recusa gravar lógica inválida com status 422 e sem criar partes", () => {
    const root = tmpDir();
    try {
      const protoDir = path.join(root, "p");
      const parts = { ...splitDcArtifact(SAMPLE_DC), logic: 'import x from "./x.js";' };
      assert.throws(() => writeDcInspection(protoDir, parts, { sourceArtifact: "a", sourceFile: "f", sourceSha256: "c".repeat(64) }),
        (err) => err.status === 422);
      assert.equal(fs.existsSync(path.join(protoDir, "dc")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
