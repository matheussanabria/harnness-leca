// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

test("Station Adapter - Mapeamento de objetos interativos para módulos", async () => {
  const { resolveStationModule } = await import("../ui/public/js/window-manager/station-adapter.js");

  assert.equal(resolveStationModule("gemini_desk"), "gemini");
  assert.equal(resolveStationModule("war_room_gemini_station"), "gemini");
  assert.equal(resolveStationModule("agent_gemini"), "gemini");

  assert.equal(resolveStationModule("claude_desk"), "claude");
  assert.equal(resolveStationModule("war_room_claude_station"), "claude");

  assert.equal(resolveStationModule("opencode_desk"), "opencode");
  assert.equal(resolveStationModule("server_rack"), "datacenter");
  assert.equal(resolveStationModule("file_cabinet"), "diario");
  assert.equal(resolveStationModule("whiteboard"), "scrum");
  assert.equal(resolveStationModule("war_room_main_panel"), "orchestration");

  assert.equal(resolveStationModule("desconhecido_xyz"), null);
});

test("Station Adapter - Abertura de janela via openStationWindow", async () => {
  const { openStationWindow } = await import("../ui/public/js/window-manager/station-adapter.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = openStationWindow("gemini_desk", { projectId: "saude-dispensacao" });
  assert.ok(win, "Deve retornar instância de janela criada");
  assert.equal(win?.moduleId, "gemini");
  assert.equal(win?.projectId, "saude-dispensacao");
  assert.equal(win?.resourceId, "gemini_desk");
  assert.equal(win?.title, "Estação Gemini");
  assert.match(win?.icon || "", /^fa-solid fa-/, "Ícone deve ser FontAwesome");

  // Reabrir o mesmo singleton não duplica
  const win2 = openStationWindow("war_room_gemini_station");
  assert.equal(win2?.id, win?.id);
  assert.equal(windowManager.getState().windows.length, 1);
});

test("Station Adapter - Alternância entre lateral (sidebar) e flutuante (floating)", async () => {
  const { openStationWindow } = await import("../ui/public/js/window-manager/station-adapter.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  windowManager.reset();

  const win = openStationWindow("gemini_desk");
  assert.ok(win);
  assert.equal(win.presentation, "sidebar");

  windowManager.setPresentation(win.id, "floating");
  let current = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(current?.presentation, "floating");

  windowManager.setPresentation(win.id, "sidebar");
  current = windowManager.getState().windows.find(w => w.id === win.id);
  assert.equal(current?.presentation, "sidebar");
});
