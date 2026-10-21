// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(".");
const MODULE_PATH = path.join(ROOT, "ui", "public", "js", "modules", "design-routines.js");
const API_PATH = path.join(ROOT, "ui", "public", "js", "modules", "design-routines-api.js");
const CSS_PATH = path.join(ROOT, "ui", "public", "css", "design", "21-rotinas.css");
const INDEX_PATH = path.join(ROOT, "ui", "public", "index.html");
const DESIGN_PATH = path.join(ROOT, "ui", "public", "js", "modules", "design.js");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

test("EP-08.05: aba de Rotinas na interface", async (t) => {
  await t.test("arquivos novos respeitam limite de linhas e nao usam emojis", () => {
    for (const file of [MODULE_PATH, API_PATH, CSS_PATH]) {
      assert.ok(fs.existsSync(file), `Arquivo ausente: ${file}`);
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/).length;
      assert.ok(lines <= 300, `${path.basename(file)} tem ${lines} linhas (limite 300).`);
      assert.equal(EMOJI_REGEX.test(content), false, `${path.basename(file)} contem emojis.`);
    }
  });

  await t.test("index e design.js conectam a aba de rotinas", () => {
    const index = fs.readFileSync(INDEX_PATH, "utf8");
    assert.ok(index.includes(`data-view="routines"`), "Aba de rotinas ausente no index.html.");
    assert.ok(index.includes("fa-solid fa-repeat"), "Icone FontAwesome ausente na aba de rotinas.");

    const design = fs.readFileSync(DESIGN_PATH, "utf8");
    assert.ok(design.includes("renderRoutinesWorkspace"), "design.js nao importa o modulo de rotinas.");
    assert.ok(design.includes(`currentView === "routines"`), "design.js nao despacha a view de rotinas.");
    assert.ok(design.split(/\r?\n/).length < 300, "design.js passou de 300 linhas.");

    const cssIndex = fs.readFileSync(path.join(ROOT, "ui", "public", "css", "design.css"), "utf8");
    assert.ok(cssIndex.includes("21-rotinas.css"), "Folha de estilo das rotinas nao importada.");
  });

  await t.test("modulo usa apenas icones FontAwesome", () => {
    const content = fs.readFileSync(MODULE_PATH, "utf8");
    const icons = content.match(/fa-[a-z-]+/g) || [];
    assert.ok(icons.length > 0, "Nenhum icone encontrado.");
    assert.equal(icons.every((icon) => icon.startsWith("fa-solid") || icon.startsWith("fa-regular") || icon.startsWith("fa-")), true);
    assert.equal(/class="[^"]*\bfa\b(?!-)/.test(content), false, "Classe de icone fora do padrao FontAwesome.");
  });
});
