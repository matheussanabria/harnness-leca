// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

const studioCoreJs = read("ui/public/js/modules/studio-core.js");
const studioLayoutJs = read("ui/public/js/modules/studio-layout.js");
const studioViewsJs = read("ui/public/js/modules/studio-views.js");
const studioHtml = read("ui/public/partials/studio.html");
const studioDrawerHtml = read("ui/public/partials/studio-drawer.html");
const studioCss = read("ui/public/css/studio/01-studio-vibecoding-canvas.css");

test("EP-06: o runtime usa o resizer de studio-layout.js e não mantém cópia em studio-core.js", () => {
  assert.match(
    studioCoreJs,
    /import\s*\{[^}]*initStudioSidebarResizer[^}]*\}\s*from\s*"\.\/studio-layout\.js"/,
    "studio-core importa a implementação canônica"
  );
  assert.match(studioCoreJs, /export\s*\{\s*initStudioSidebarResizer\s*\}/, "O export continua disponível");
  assert.doesNotMatch(studioCoreJs, /export function initStudioSidebarResizer/, "Não há implementação duplicada");
  assert.doesNotMatch(studioCoreJs, /addEventListener\("keydown"/, "O teclado do resizer vive só em studio-layout");
  assert.match(studioCoreJs, /onPersist: \(next\) => void saveStudioState\(\{ sidebarWidth: next \}\)/, "O estado da tela é persistido");
});

test("EP-06: studio-layout.js mantém PageUp/PageDown, duplo clique e persistência injetada", () => {
  assert.match(studioLayoutJs, /export function initStudioSidebarResizer/);
  assert.match(studioLayoutJs, /e\.key === "PageDown"/);
  assert.match(studioLayoutJs, /e\.key === "PageUp"/);
  assert.match(studioLayoutJs, /addEventListener\("dblclick"/);
  assert.match(studioLayoutJs, /options\.onPersist/);
});

test("EP-06: o modo Design tem botão no canvas e na gaveta mobile", () => {
  assert.match(
    studioHtml,
    /id="btnViewDesign"[^>]*onclick="setStudioModeType\('design'\)"[^>]*><i class="fa-solid fa-pen-ruler"><\/i> Design/,
    "btnViewDesign existe no canvas"
  );
  assert.match(
    studioDrawerHtml,
    /id="btnDrawerDesign"[^>]*onclick="setStudioModeType\('design'\); toggleMobileStudioDrawer\(false\)"[^>]*><i class="fa-solid fa-pen-ruler"><\/i> Design/,
    "btnDrawerDesign existe na gaveta"
  );
  assert.match(studioViewsJs, /\$\("btnViewDesign"\)/, "A view alterna o botão do canvas");
  assert.match(studioViewsJs, /\$\("btnDrawerDesign"\)/, "A view alterna o botão da gaveta");
});

test("EP-06: o workspace de Design tem estilo mínimo para aparecer quando ativo", () => {
  assert.match(studioCss, /\.studio-design-workspace\s*\{[^}]*flex:\s*1/);
  assert.match(studioCss, /\.studio-design-workspace\s*\{[^}]*min-height:\s*0/);
  assert.match(studioCss, /\.studio-design-workspace\s*\{[^}]*overflow:\s*auto/);
});
