// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Taskbar - Modelo de itens e detecção de status (getTaskbarItemModel)", async () => {
  const { getTaskbarItemModel } = await import("../ui/public/js/window-manager/taskbar.js");

  const win1 = /** @type {any} */ ({
    id: "win-1",
    title: "Estação Gemini",
    icon: "fa-solid fa-sparkles",
    visibility: "visible"
  });

  // Janela com foco
  const m1 = getTaskbarItemModel(win1, "win-1");
  assert.equal(m1.isFocused, true);
  assert.equal(m1.isMinimized, false);
  assert.equal(m1.isVisible, false);

  // Janela visível em segundo plano
  const m2 = getTaskbarItemModel(win1, "win-outro");
  assert.equal(m2.isFocused, false);
  assert.equal(m2.isMinimized, false);
  assert.equal(m2.isVisible, true);

  // Janela minimizada
  const winMin = /** @type {any} */ ({
    id: "win-2",
    title: "Estação Claude",
    icon: "fa-solid fa-brain",
    visibility: "minimized"
  });
  const m3 = getTaskbarItemModel(winMin, "win-outro");
  assert.equal(m3.isFocused, false);
  assert.equal(m3.isMinimized, true);
  assert.equal(m3.isVisible, false);
});

test("Taskbar - Resolução de ação de clique (resolveTaskbarClickAction)", async () => {
  const { resolveTaskbarClickAction } = await import("../ui/public/js/window-manager/taskbar.js");

  // Minimizada -> clica para restaurar
  assert.equal(
    resolveTaskbarClickAction({
      id: "w1",
      title: "W1",
      icon: "fa-solid fa-code",
      isMinimized: true,
      isFocused: false,
      isVisible: false
    }),
    "restore"
  );

  // Focada -> clica para minimizar (comportamento clássico de taskbar)
  assert.equal(
    resolveTaskbarClickAction({
      id: "w1",
      title: "W1",
      icon: "fa-solid fa-code",
      isMinimized: false,
      isFocused: true,
      isVisible: false
    }),
    "minimize"
  );

  // Visível em segundo plano -> clica para focar
  assert.equal(
    resolveTaskbarClickAction({
      id: "w1",
      title: "W1",
      icon: "fa-solid fa-code",
      isMinimized: false,
      isFocused: false,
      isVisible: true
    }),
    "focus"
  );
});

test("Taskbar - Integração com WindowManager e despacho de eventos", async () => {
  const { TaskbarComponent } = await import("../ui/public/js/window-manager/taskbar.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  let clickHandler = null;
  const classList = new Set();
  const mockContainer = /** @type {any} */ ({
    innerHTML: "",
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c)
    },
    addEventListener: (evt, fn) => {
      if (evt === "click") clickHandler = fn;
    }
  });

  const taskbar = new TaskbarComponent({
    container: mockContainer,
    windowManager
  });

  // Inicialmente vazio
  assert.equal(classList.has("is-empty"), true);

  // Abrir primeira janela
  const win = windowManager.open("gemini");
  assert.ok(win);
  assert.equal(classList.has("is-empty"), false);
  assert.match(mockContainer.innerHTML, /fa-solid fa-/);
  assert.match(mockContainer.innerHTML, /Estação Gemini/);
  assert.match(mockContainer.innerHTML, /is-focused/);

  // Simular clique para minimizar
  const mockItemTarget = {
    closest: (sel) => {
      if (sel === ".taskbar-item") {
        return { getAttribute: (attr) => (attr === "data-window-id" ? win.id : null) };
      }
      return null;
    }
  };
  clickHandler({ target: mockItemTarget });
  assert.equal(windowManager.getState().windows.find(w => w.id === win.id)?.visibility, "minimized");
  assert.match(mockContainer.innerHTML, /is-minimized/);

  // Simular clique para restaurar
  clickHandler({ target: mockItemTarget });
  assert.equal(windowManager.getState().windows.find(w => w.id === win.id)?.visibility, "visible");
  assert.match(mockContainer.innerHTML, /is-focused/);

  // Simular clique no botão de fechar
  let stopped = false;
  const mockCloseTarget = {
    closest: (sel) => {
      if (sel === ".taskbar-item-close") {
        return {
          closest: (innerSel) => (innerSel === "[data-window-id]" ? { getAttribute: () => win.id } : null)
        };
      }
      return null;
    }
  };
  clickHandler({
    target: mockCloseTarget,
    stopPropagation: () => { stopped = true; }
  });
  assert.equal(stopped, true);
  assert.equal(windowManager.getState().windows.length, 0);
  assert.equal(classList.has("is-empty"), true);

  taskbar.destroy();
});
