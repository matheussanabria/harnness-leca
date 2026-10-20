// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Focus Manager - Detecção de elementos em edição (isElementEditing)", async () => {
  const { isElementEditing } = await import("../ui/public/js/window-manager/focus-manager.js");

  assert.equal(isElementEditing(null), false);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "DIV" })), false);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "BUTTON" })), false);

  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "INPUT" })), true);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "TEXTAREA" })), true);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "SELECT" })), true);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "OPTION" })), true);
  assert.equal(isElementEditing(/** @type {any} */ ({ tagName: "DIV", isContentEditable: true })), true);
});

test("Focus Manager - Detecção de elementos dentro de janelas (isElementInsideWindow)", async () => {
  const { isElementInsideWindow } = await import("../ui/public/js/window-manager/focus-manager.js");

  assert.equal(isElementInsideWindow(null), false);

  const mockInsideWindow = /** @type {any} */ ({
    closest: (selector) => selector.includes(".window-frame") || selector.includes(".office-drawer.open")
  });
  assert.equal(isElementInsideWindow(mockInsideWindow), true);

  const mockOutside = /** @type {any} */ ({
    closest: () => null
  });
  assert.equal(isElementInsideWindow(mockOutside), false);
});

test("Focus Manager - Regra de bloqueio de navegação 3D/2.5D (isNavigationBlocked)", async () => {
  const { isNavigationBlocked } = await import("../ui/public/js/window-manager/focus-manager.js");

  // Sem janela e sem foco em input: navegação liberada
  assert.equal(isNavigationBlocked({ activeElement: null, hasActiveWindow: false }), false);

  // Foco em input: bloqueado
  assert.equal(
    isNavigationBlocked({
      activeElement: /** @type {any} */ ({ tagName: "INPUT" }),
      hasActiveWindow: false
    }),
    true
  );

  // Foco dentro de janela: bloqueado
  assert.equal(
    isNavigationBlocked({
      activeElement: /** @type {any} */ ({
        tagName: "DIV",
        closest: (sel) => sel.includes(".window-frame")
      }),
      hasActiveWindow: false
    }),
    true
  );

  // Janela ativa e aberta: bloqueado
  assert.equal(isNavigationBlocked({ activeElement: null, hasActiveWindow: true }), true);
});

test("Focus Manager - Manipulação de tecla Escape (handleNavigationKey)", async () => {
  const { handleNavigationKey } = await import("../ui/public/js/window-manager/focus-manager.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  // 1. Tecla qualquer não é tratada
  const rOther = handleNavigationKey({ code: "KeyW", key: "w" });
  assert.equal(rOther.handled, false);

  // 2. Escape com janela ativa deve fechar a janela
  const win = windowManager.open("gemini");
  assert.ok(win);
  assert.equal(windowManager.getState().windows.length, 1);

  const rEscWin = handleNavigationKey({ code: "Escape", key: "Escape" }, { windowManager });
  assert.equal(rEscWin.handled, true);
  assert.equal(rEscWin.action, "close_window");
  assert.equal(windowManager.getState().windows.length, 0);

  // 3. Escape com PointerLock ativo deve liberar o cursor
  let pointerLockExited = false;
  const rEscLock = handleNavigationKey(
    { code: "Escape", key: "Escape" },
    {
      windowManager,
      isPointerLocked: () => true,
      exitPointerLock: () => { pointerLockExited = true; }
    }
  );
  assert.equal(rEscLock.handled, true);
  assert.equal(rEscLock.action, "exit_pointer_lock");
  assert.equal(pointerLockExited, true);

  // 4. Escape com avatar sentado deve levantar
  let stoodUp = false;
  const rEscSeat = handleNavigationKey(
    { code: "Escape", key: "Escape" },
    {
      windowManager,
      isPointerLocked: () => false,
      isSeated: true,
      standUp: () => { stoodUp = true; }
    }
  );
  assert.equal(rEscSeat.handled, true);
  assert.equal(rEscSeat.action, "stand_up");
  assert.equal(stoodUp, true);
});

test("Focus Manager - Foco ao clicar em janela (handlePointerDown)", async () => {
  const { FocusManager } = await import("../ui/public/js/window-manager/focus-manager.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const fm = new FocusManager({ windowManager });

  const win1 = windowManager.open("gemini");
  const win2 = windowManager.open("claude");
  assert.ok(win1 && win2);
  assert.equal(windowManager.getState().activeWindowId, win2.id);

  // Simular clique na janela win1
  const mockTarget = /** @type {any} */ ({
    closest: (sel) => {
      if (sel === "[data-window-id]") {
        return { getAttribute: (attr) => (attr === "data-window-id" ? win1.id : null) };
      }
      return null;
    }
  });

  fm.handlePointerDown(mockTarget);
  assert.equal(windowManager.getState().activeWindowId, win1.id);
  assert.ok(win1.zIndex > win2.zIndex, "win1 deve ter zIndex superior após receber foco");
});
