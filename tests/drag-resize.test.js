// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Drag & Resize - Confinamento de limites em viewport (constrainBounds)", async () => {
  const { constrainBounds } = await import("../ui/public/js/window-manager/drag-resize.js");

  const viewport = { width: 1920, height: 1080 };

  // Janela com dimensões abaixo do mínimo deve ser ajustada
  const tooSmall = constrainBounds({ x: 50, y: 50, width: 200, height: 100 }, viewport);
  assert.equal(tooSmall.width, 320, "Largura mínima deve ser 320");
  assert.equal(tooSmall.height, 240, "Altura mínima deve ser 240");

  // Janela saindo pela esquerda ou topo deve ser contida
  const outOfBoundsTopLeft = constrainBounds({ x: -100, y: -20, width: 600, height: 400 }, viewport);
  assert.equal(outOfBoundsTopLeft.x, 0, "X não pode ser negativo");
  assert.ok(outOfBoundsTopLeft.y >= 40, "Y deve respeitar espaço mínimo da topbar");

  // Janela saindo pela direita ou fundo deve ser contida
  const outOfBoundsBottomRight = constrainBounds({ x: 2000, y: 1500, width: 600, height: 400 }, viewport);
  assert.ok(outOfBoundsBottomRight.x <= 1920 - 600, "X máximo deve manter janela na tela");
  assert.ok(outOfBoundsBottomRight.y <= 1080 - 400, "Y máximo deve manter janela na tela");
});

test("Drag & Resize - Cálculo de novo posicionamento por arraste (computeMoveBounds)", async () => {
  const { computeMoveBounds } = await import("../ui/public/js/window-manager/drag-resize.js");

  const viewport = { width: 1280, height: 720 };
  const initial = { x: 100, y: 100, width: 500, height: 400 };

  // Movimento livre dentro da tela
  const moved = computeMoveBounds(initial, 50, 60, viewport);
  assert.equal(moved.x, 150);
  assert.equal(moved.y, 160);
  assert.equal(moved.width, 500);
  assert.equal(moved.height, 400);

  // Arraste para fora da tela é travado
  const clamped = computeMoveBounds(initial, 2000, 2000, viewport);
  assert.equal(clamped.x, 1280 - 500);
  assert.ok(clamped.y <= 720 - 400);
});

test("Drag & Resize - Cálculo de redimensionamento (computeResizeBounds)", async () => {
  const { computeResizeBounds } = await import("../ui/public/js/window-manager/drag-resize.js");

  const viewport = { width: 1280, height: 720 };
  const initial = { x: 100, y: 100, width: 500, height: 400 };

  // Expansão
  const enlarged = computeResizeBounds(initial, 100, 50, viewport);
  assert.equal(enlarged.width, 600);
  assert.equal(enlarged.height, 450);

  // Redução drástica bloqueia no mínimo permitido
  const shrunk = computeResizeBounds(initial, -400, -350, viewport);
  assert.equal(shrunk.width, 320);
  assert.equal(shrunk.height, 240);
});

test("Drag & Resize - Controlador e duplo clique para alternar maximização", async () => {
  const { WindowDragResizeController } = await import("../ui/public/js/window-manager/drag-resize.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = windowManager.open("gemini", { presentation: "floating" });
  assert.ok(win);
  assert.equal(win.presentation, "floating");

  const controller = new WindowDragResizeController({ windowManager });

  let dblClickHandler = null;
  const mockHeader = /** @type {any} */ ({
    addEventListener: (evt, fn) => {
      if (evt === "dblclick") dblClickHandler = fn;
    }
  });
  const mockWindowEl = /** @type {any} */ ({});

  controller.attach(mockWindowEl, mockHeader, null, () => win.id);

  // Simula duplo clique no cabeçalho
  assert.ok(dblClickHandler);
  dblClickHandler({ target: mockHeader });

  let updated = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(updated?.presentation, "maximized", "Duplo clique deve maximizar");

  // Segundo duplo clique restaura
  dblClickHandler({ target: mockHeader });
  updated = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(updated?.presentation, "floating", "Segundo duplo clique deve restaurar para floating");
});
