// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Window Lifecycle - Minimização e preservação de estado transiente", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("gemini");
  assert.ok(win);
  assert.equal(win.visibility, "visible");
  assert.equal(win.isFocused, true);

  // Simula usuário digitando ou rolando o container
  windowManager.saveState(win.id, {
    draftMessage: "Olá Gemini, analise o código do sprint",
    scrollTop: 450
  });

  // Minimizar
  windowManager.minimize(win.id);
  const stateMin = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(stateMin?.visibility, "minimized");
  assert.equal(stateMin?.isFocused, false);

  // O estado salvo permanece intacto
  const saved = windowManager.getSavedState(win.id);
  assert.deepEqual(saved, {
    draftMessage: "Olá Gemini, analise o código do sprint",
    scrollTop: 450
  });
});

test("Window Lifecycle - Restauração mantém integridade e devolve foco", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("claude", {
    bounds: { x: 120, y: 150, width: 800, height: 600 }
  });
  assert.ok(win);

  windowManager.minimize(win.id);
  assert.equal(windowManager.getState().windows.find(w => w.id === win.id)?.visibility, "minimized");

  // Restaurar
  windowManager.restore(win.id);
  const restored = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(restored?.visibility, "visible");
  assert.equal(restored?.isFocused, true);
  assert.equal(windowManager.getState().activeWindowId, win.id);

  // Bounds permanecem preservados
  assert.equal(restored?.bounds.x, 120);
  assert.equal(restored?.bounds.y, 150);
  assert.equal(restored?.bounds.width, 800);
  assert.equal(restored?.bounds.height, 600);
});

test("Window Lifecycle - Fechamento executa hooks de limpeza e libera memória", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("opencode");
  assert.ok(win);

  let cleanupExecuted = false;
  let timerCleared = false;

  // Módulo registra limpeza de timers/recursos
  const timerId = setTimeout(() => {}, 10000);
  windowManager.onClose(win.id, () => {
    cleanupExecuted = true;
    clearTimeout(timerId);
    timerCleared = true;
  });

  windowManager.saveState(win.id, { temporaryToken: "12345" });

  // Fechar
  windowManager.close(win.id);

  assert.equal(cleanupExecuted, true, "Hook de limpeza deve ser executado no fechamento");
  assert.equal(timerCleared, true, "Recursos temporários devem ser liberados");
  assert.equal(windowManager.getState().windows.length, 0, "Janela deve ser removida da lista");
  assert.equal(windowManager.getSavedState(win.id), null, "Estado transiente deve ser descartado");
});

test("Window Lifecycle - Desregistro prematuro de hook de limpeza", async () => {
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("datacenter");
  assert.ok(win);

  let cleanupCallCount = 0;
  const unregister = windowManager.onClose(win.id, () => {
    cleanupCallCount += 1;
  });

  // Cancela o hook antes de fechar
  unregister();

  windowManager.close(win.id);
  assert.equal(cleanupCallCount, 0, "Callback desregistrado não deve ser chamado");
});
