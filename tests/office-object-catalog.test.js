// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  OFFICE_OBJECT_CATALOG,
  getOfficeObject,
  resolveObjectId,
  listOfficeObjects,
  getOfficeObjectsFor2D,
  getOfficeObjectsFor3D
} from "../ui/public/js/office/office-object-catalog.js";
import { OFFICE_2D_OBJECTS } from "../ui/public/js/office2d/map-objects.js";
import { resolveStationModule } from "../ui/public/js/window-manager/station-adapter.js";

// Regex de detecção de emojis Unicode
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

test("EP-03.01 - Integridade do catálogo canônico de objetos", () => {
  assert.ok(Array.isArray(OFFICE_OBJECT_CATALOG), "O catálogo deve ser um array");
  assert.ok(OFFICE_OBJECT_CATALOG.length >= 15, "Catálogo deve conter pelo menos 15 objetos principais");

  const validCategories = new Set(["workstation", "agent_station", "collaboration", "infrastructure", "lounge"]);
  const validActionTypes = new Set(["window", "drawer", "seat", "screen_focus", "custom"]);
  const ids = new Set();

  for (const obj of OFFICE_OBJECT_CATALOG) {
    assert.ok(obj.id && typeof obj.id === "string", `Objeto deve ter ID válido: ${JSON.stringify(obj)}`);
    assert.ok(!ids.has(obj.id), `ID duplicado detectado: ${obj.id}`);
    ids.add(obj.id);

    assert.ok(obj.name && typeof obj.name === "string", `Objeto ${obj.id} deve ter name válido`);
    assert.ok(validCategories.has(obj.category), `Objeto ${obj.id} tem categoria inválida: ${obj.category}`);
    assert.ok(validActionTypes.has(obj.actionType), `Objeto ${obj.id} tem actionType inválido: ${obj.actionType}`);
    assert.ok(obj.badge && typeof obj.badge === "string", `Objeto ${obj.id} deve ter badge`);
    assert.match(obj.badgeColor, /^#[0-9a-fA-F]{6}$/, `Objeto ${obj.id} deve ter badgeColor hex válido`);
    assert.ok(obj.icon && (obj.icon.startsWith("fa-solid ") || obj.icon.startsWith("fa-regular ")), `Objeto ${obj.id} deve usar FontAwesome: ${obj.icon}`);
    assert.ok(obj.label && obj.label.startsWith("[E]"), `Objeto ${obj.id} deve ter label padrão [E]: ${obj.label}`);
    assert.ok(obj.sub && typeof obj.sub === "string", `Objeto ${obj.id} deve ter sub`);
    assert.equal(obj.keyHint, "E", `Objeto ${obj.id} deve usar tecla de atalho E`);
  }
});

test("EP-03.01 - Proibição estrita de emojis no catálogo e no mapa 2D", () => {
  for (const obj of OFFICE_OBJECT_CATALOG) {
    assert.ok(!EMOJI_REGEX.test(obj.id), `ID contém emoji: ${obj.id}`);
    assert.ok(!EMOJI_REGEX.test(obj.name), `Nome contém emoji: ${obj.name}`);
    assert.ok(!EMOJI_REGEX.test(obj.badge), `Badge contém emoji: ${obj.badge}`);
    assert.ok(!EMOJI_REGEX.test(obj.icon), `Icon contém emoji: ${obj.icon}`);
    assert.ok(!EMOJI_REGEX.test(obj.label), `Label contém emoji: ${obj.label}`);
    assert.ok(!EMOJI_REGEX.test(obj.sub), `Sub contém emoji: ${obj.sub}`);
  }

  for (const obj of OFFICE_2D_OBJECTS) {
    assert.ok(!EMOJI_REGEX.test(obj.icon), `Ícone 2D contém emoji: ${obj.icon}`);
    assert.ok(obj.icon.startsWith("fa-solid ") || obj.icon.startsWith("fa-regular "), `Ícone 2D deve ser FontAwesome: ${obj.icon}`);
  }
});

test("EP-03.01 - Resolução de objetos canônicos e aliases legados", () => {
  // Canônico direto
  const claude = getOfficeObject("claude_station");
  assert.ok(claude, "Deve encontrar claude_station");
  assert.equal(claude.id, "claude_station");
  assert.equal(resolveObjectId("claude_station"), "claude_station");

  // Aliases legados 2D e 3D
  assert.equal(resolveObjectId("claude_desk"), "claude_station");
  assert.equal(resolveObjectId("war_room_claude_station"), "claude_station");
  assert.equal(resolveObjectId("agent_claude"), "claude_station");

  // Aliases de mobílias
  assert.equal(resolveObjectId("meeting_table"), "war_room_table_console");
  assert.equal(resolveObjectId("orch_core"), "war_room_table_console");
  assert.equal(resolveObjectId("sofa"), "lounge_couch");
  assert.equal(resolveObjectId("couch"), "lounge_couch");

  // ID inexistente mantém o termo original
  assert.equal(resolveObjectId("unknown_id"), "unknown_id");
  assert.equal(getOfficeObject("unknown_id"), undefined);
});

test("EP-03.01 - Formatação para visualização 2D e 3D", () => {
  const items2D = getOfficeObjectsFor2D();
  assert.ok(items2D.length >= 10, "Deve extrair objetos 2D");
  for (const item of items2D) {
    assert.ok(typeof item.gx === "number", `gx deve ser numérico: ${item.id}`);
    assert.ok(typeof item.gy === "number", `gy deve ser numérico: ${item.id}`);
    assert.ok(typeof item.w === "number", `w deve ser numérico: ${item.id}`);
    assert.ok(typeof item.h === "number", `h deve ser numérico: ${item.id}`);
    assert.ok(item.icon.startsWith("fa-solid "), `Ícone 2D deve ser FontAwesome: ${item.icon}`);
  }

  const items3D = getOfficeObjectsFor3D();
  assert.ok(items3D.length >= 14, "Deve extrair objetos 3D");
  for (const item of items3D) {
    assert.ok(item.position3D, `Deve ter position3D: ${item.id}`);
    assert.ok(typeof item.distance === "number", `distance deve ser numérico: ${item.id}`);
    assert.ok(typeof item.offsetY === "number", `offsetY deve ser numérico: ${item.id}`);
  }
});

test("EP-03.01 - Integração do catálogo com o StationAdapter do Window Manager", () => {
  assert.equal(resolveStationModule("claude_station"), "claude");
  assert.equal(resolveStationModule("gemini_station"), "gemini");
  assert.equal(resolveStationModule("opencode_station"), "opencode");
  assert.equal(resolveStationModule("codex_station"), "codex");
  assert.equal(resolveStationModule("war_room_main_panel"), "orchestration");
  assert.equal(resolveStationModule("war_room_table_console"), "orchestration");
  assert.equal(resolveStationModule("server_rack"), "datacenter");
  assert.equal(resolveStationModule("file_cabinet"), "diario");
  assert.equal(resolveStationModule("prototype_board"), "studio");
  assert.equal(resolveStationModule("whiteboard"), "scrum");
});
