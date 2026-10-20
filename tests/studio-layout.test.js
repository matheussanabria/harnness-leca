// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const moduleUrl = (relativePath) => pathToFileURL(path.join(__dirname, "..", relativePath)).href;

function createMockStorage() {
  /** @type {Record<string, string>} */
  const store = {};
  return {
    getItem(key) {
      return store[key] !== undefined ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

function createMockElement() {
  /** @type {Record<string, string>} */
  const attrs = {};
  return {
    style: { width: "" },
    setAttribute(key, val) {
      attrs[key] = String(val);
    },
    getAttribute(key) {
      return attrs[key] !== undefined ? attrs[key] : null;
    },
    getBoundingClientRect() {
      return { width: 440, height: 600, top: 0, left: 0 };
    },
  };
}

test("studio-layout: calcula limites dinâmicos para a barra lateral garantindo canvas utilizável", async () => {
  const { calculateSidebarBounds } = await import(moduleUrl("ui/public/js/modules/studio-layout.js"));

  // Viewport desktop padrão (1920px): min 300, max teto 850
  const wide = calculateSidebarBounds(1920);
  assert.equal(wide.min, 300);
  assert.equal(wide.max, 850);

  // Viewport compacto (750px): canvas min 300 deixa max em 450
  const compact = calculateSidebarBounds(750);
  assert.equal(compact.min, 300);
  assert.equal(compact.max, 450);

  // Viewport ultra-compacto (500px): max não cai abaixo do min de 300
  const narrow = calculateSidebarBounds(500);
  assert.equal(narrow.min, 300);
  assert.equal(narrow.max, 300);
});

test("studio-layout: clampSidebarWidth restringe a largura aos limites de viewport", async () => {
  const { clampSidebarWidth } = await import(moduleUrl("ui/public/js/modules/studio-layout.js"));

  // Em viewport desktop padrão (1920px):
  assert.equal(clampSidebarWidth(150, 1920), 300);
  assert.equal(clampSidebarWidth(480, 1920), 480);
  assert.equal(clampSidebarWidth(1200, 1920), 850);

  // Em viewport menor (800px - max de 500px):
  assert.equal(clampSidebarWidth(700, 800), 500);
});

test("studio-layout: resolveStorageKey isola chave por projeto com fallback global", async () => {
  const { resolveStorageKey } = await import(moduleUrl("ui/public/js/modules/studio-layout.js"));

  assert.equal(resolveStorageKey(), "harness_studio_sidebar_width");
  assert.equal(resolveStorageKey(""), "harness_studio_sidebar_width");
  assert.equal(resolveStorageKey("57multimarcas"), "harness_studio_sidebar_width_57multimarcas");
  assert.equal(resolveStorageKey("saude-dispensacao"), "harness_studio_sidebar_width_saude-dispensacao");
});

test("studio-layout: getStoredSidebarWidth e saveStoredSidebarWidth persistem largura corretamente", async () => {
  const { getStoredSidebarWidth, saveStoredSidebarWidth } = await import(moduleUrl("ui/public/js/modules/studio-layout.js"));
  const storage = createMockStorage();

  // Sem valor persistido, retorna default 440
  assert.equal(getStoredSidebarWidth(storage, "projeto-a"), 440);

  // Salva no projeto-a
  saveStoredSidebarWidth(storage, 520, "projeto-a");
  assert.equal(getStoredSidebarWidth(storage, "projeto-a"), 520);

  // Outro projeto ainda usa default ou fallback global
  assert.equal(getStoredSidebarWidth(storage, "projeto-b"), 440);

  // Se houver valor global, serve de fallback
  saveStoredSidebarWidth(storage, 460);
  assert.equal(getStoredSidebarWidth(storage, "projeto-b"), 460);
});

test("studio-layout: applySidebarWidth atualiza style.width e atributos ARIA do separator", async () => {
  const { applySidebarWidth } = await import(moduleUrl("ui/public/js/modules/studio-layout.js"));
  const sidebar = createMockElement();
  const resizer = createMockElement();
  const storage = createMockStorage();

  const applied = applySidebarWidth(sidebar, resizer, 550, true, storage, "meu-projeto");
  assert.equal(applied, 550);
  assert.equal(sidebar.style.width, "550px");
  assert.equal(resizer.getAttribute("aria-valuenow"), "550");
  assert.equal(resizer.getAttribute("aria-valuemin"), "300");
  assert.equal(resizer.getAttribute("aria-valuemax"), "850");
  assert.equal(storage.getItem("harness_studio_sidebar_width_meu-projeto"), "550");
});
