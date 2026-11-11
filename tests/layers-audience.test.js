import test from "node:test";
import assert from "node:assert/strict";
import { AUDIENCES, visibleLayerIds, resolveActiveLayer } from "../ui/public/js/modules/design-layers/layers-audience-profiles.js";
import { applyLayersState } from "../ui/public/js/modules/design-layers-state.js";
import { dls } from "../ui/public/js/modules/design-layers-store.js";

test("perfil Tudo mostra as 6 camadas e usuario final so UI e regras", () => {
  assert.equal(visibleLayerIds("all").length, 6);
  assert.deepEqual(visibleLayerIds("user"), ["ui", "rules"]);
  assert.equal(AUDIENCES.length, 5);
});

test("camada oculta pelo perfil cai na primeira visivel", () => {
  assert.equal(resolveActiveLayer("user", "api"), "ui");
  assert.equal(resolveActiveLayer("qa", "ui"), "rules");
  assert.equal(resolveActiveLayer("dev", "data"), "data");
});

test("estado persistido aceita apenas perfis validos", () => {
  applyLayersState({ audience: "qa" });
  assert.equal(dls.activeAudience, "qa");
  applyLayersState({ audience: "hacker" });
  assert.equal(dls.activeAudience, "qa");
});
