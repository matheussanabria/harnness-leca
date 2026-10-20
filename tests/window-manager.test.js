// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Window Manager - Registro de módulos e catálogo padrão", async () => {
  const { listModules, getModule, registerModule, unregisterModule } = await import("../ui/public/js/window-manager/window-registry.js");

  const modules = listModules();
  assert.ok(modules.length >= 8, "Deve conter ao menos 8 módulos padrão pré-registrados");

  const gemini = getModule("gemini");
  assert.ok(gemini, "Módulo gemini deve estar registrado");
  assert.equal(gemini?.title, "Estação Gemini");
  assert.equal(gemini?.icon, "fa-solid fa-wand-magic-sparkles");
  assert.equal(gemini?.isSingleton, true);

  // Proibição de emojis em ícones
  for (const mod of modules) {
    assert.match(mod.icon, /^fa-(solid|regular|brands) fa-/, `Ícone do módulo ${mod.id} deve ser FontAwesome sem emojis`);
  }

  // Registro de módulo customizado
  registerModule({
    id: "test-module",
    title: "Módulo Teste",
    icon: "fa-solid fa-flask-vial",
    isSingleton: false
  });
  const custom = getModule("test-module");
  assert.equal(custom?.title, "Módulo Teste");
  assert.equal(custom?.isSingleton, false);

  // Validação de erro em módulo sem id ou sem ícone
  // @ts-ignore
  assert.throws(() => registerModule({ title: "Inválido" }), /campo 'id' obrigatório/);
  // @ts-ignore
  assert.throws(() => registerModule({ id: "no-icon" }), /ícone FontAwesome válido/);

  unregisterModule("test-module");
  assert.equal(getModule("test-module"), undefined);
});

test("Window Manager - Abertura e comportamento Singleton vs Multi-instância", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  // Gemini é singleton
  const win1 = windowManager.open("gemini");
  assert.equal(win1.moduleId, "gemini");
  assert.equal(win1.isFocused, true);
  assert.equal(windowManager.getState().windows.length, 1);

  // Reabertura de singleton deve focar a existente sem duplicar
  const win2 = windowManager.open("gemini");
  assert.equal(win2.id, win1.id);
  assert.equal(windowManager.getState().windows.length, 1);

  // Studio é multi-instância (isSingleton: false)
  const studio1 = windowManager.open("studio");
  const studio2 = windowManager.open("studio");
  assert.notEqual(studio1.id, studio2.id);
  assert.equal(windowManager.getState().windows.length, 3);
});

test("Window Manager - Gerenciamento de foco e camadas zIndex", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const winA = windowManager.open("gemini");
  const winB = windowManager.open("claude");

  // winB foi aberto por último, deve estar com maior zIndex e focado
  assert.ok(winB.zIndex > winA.zIndex);
  assert.equal(winB.isFocused, true);
  assert.equal(windowManager.getState().activeWindowId, winB.id);

  // Foca winA
  windowManager.focus(winA.id);
  const state = windowManager.getState();
  const updatedA = state.windows.find(w => w.id === winA.id);
  const updatedB = state.windows.find(w => w.id === winB.id);

  assert.ok(updatedA && updatedB);
  assert.ok(updatedA.zIndex > updatedB.zIndex, "winA deve estar na camada mais alta");
  assert.equal(updatedA.isFocused, true);
  assert.equal(updatedB.isFocused, false);
  assert.equal(state.activeWindowId, winA.id);
});

test("Window Manager - Minimização, restauração e recálculo de foco", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win1 = windowManager.open("gemini");
  const win2 = windowManager.open("datacenter");

  // Minimiza a janela ativa (win2)
  windowManager.minimize(win2.id);
  let state = windowManager.getState();
  let updated2 = state.windows.find(w => w.id === win2.id);
  assert.equal(updated2?.visibility, "minimized");
  assert.equal(updated2?.isFocused, false);

  // O foco ativo deve transferir para win1
  assert.equal(state.activeWindowId, win1.id);

  // Restaura win2
  windowManager.restore(win2.id);
  state = windowManager.getState();
  updated2 = state.windows.find(w => w.id === win2.id);
  assert.equal(updated2?.visibility, "visible");
  assert.equal(updated2?.isFocused, true);
  assert.equal(state.activeWindowId, win2.id);
});

test("Window Manager - Maximização e restauração de limites anteriores", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("datacenter", {
    bounds: { x: 50, y: 50, width: 400, height: 300 }
  });

  // Maximiza
  windowManager.toggleMaximize(win.id);
  let state = windowManager.getState();
  let current = state.windows.find(w => w.id === win.id);
  assert.equal(current?.presentation, "maximized");

  // Desmaximiza
  windowManager.toggleMaximize(win.id);
  state = windowManager.getState();
  current = state.windows.find(w => w.id === win.id);
  assert.equal(current?.presentation, "floating");
  assert.equal(current?.bounds.width, 400);
  assert.equal(current?.bounds.height, 300);
});

test("Window Manager - Fechamento e reatividade com ouvintes (subscribe)", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  let notifications = 0;
  const unsubscribe = windowManager.subscribe(() => {
    notifications += 1;
  });

  const win = windowManager.open("scrum");
  assert.ok(notifications >= 1);

  windowManager.close(win.id);
  assert.equal(windowManager.getState().windows.length, 0);
  assert.equal(windowManager.getState().activeWindowId, null);

  unsubscribe();
  const initialCount = notifications;
  windowManager.open("diario");
  assert.equal(notifications, initialCount, "Ouvinte cancelado não deve ser chamado");
});
