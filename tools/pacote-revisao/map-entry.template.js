// Mapa em camadas estatico: usa os modulos reais do Harness com dados embutidos (sem servidor).
// __PUB__ e trocado pelo caminho de ui/public na hora do build.
import "__PUB__/css/base.css";
import "__PUB__/css/components.css";
import "__PUB__/css/design.css";
import data from "./static-data.json";
import { state } from "__PUB__/js/shared/state.js";
import { dls } from "__PUB__/js/modules/design-layers-store.js";
import { renderLayersWorkspace } from "__PUB__/js/modules/design-layers-workspace.js";

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
// Sem servidor: o estado das telas nao persiste e nenhuma chamada sai da pagina.
window.fetch = async () => json({ state: {}, rev: 0 });
window.__PROTOS__ = data.protos;
state.P = { name: data.slug };
state.S = { active: data.slug };

const container = document.getElementById("designViewContainer");
const screens = data.screensData.screens;

function syncHash() {
  const f = dls.focusedFieldId ? "/" + dls.focusedFieldId : "";
  try { history.replaceState(null, "", "#" + dls.activeScreenId + f); } catch { /* file:// restrito */ }
}
["selectActiveScreen", "setFocusedField", "openLayersTarget"].forEach((name) => {
  const original = window[name];
  window[name] = (...args) => { const r = original(...args); syncHash(); return r; };
});

function applyHash() {
  const [screenId, fieldId] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (screenId && screens.some((s) => s.id === screenId)) window.openLayersTarget(screenId, fieldId || null);
}
renderLayersWorkspace(container, data.slug, data.screensData);
applyHash();
window.addEventListener("hashchange", applyHash);
