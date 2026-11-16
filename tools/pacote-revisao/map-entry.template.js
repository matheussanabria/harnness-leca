// Mapa em camadas estatico: usa os modulos reais do Harness com dados embutidos (sem servidor).
// __PUB__ e trocado pelo caminho de ui/public na hora do build.
import "__PUB__/css/base.css";
import "__PUB__/css/components.css";
import "__PUB__/css/design.css";
import data from "./static-data.json";
import { state } from "__PUB__/js/shared/state.js";
import { dls } from "__PUB__/js/modules/design-layers-store.js";
import { renderLayersWorkspace } from "__PUB__/js/modules/design-layers-workspace.js";
import { embeddedDocsSource, setDocsSource } from "__PUB__/js/modules/design-layers/docs/docs-source.js";
import { setDocsLinkMode } from "__PUB__/js/modules/design-layers/docs/docs-location.js";
import { openDocFromLocation } from "__PUB__/js/modules/design-layers/docs/docs-panel.js";

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
// Sem servidor: o estado das telas nao persiste e nenhuma chamada sai da pagina.
window.fetch = async () => json({ state: {}, rev: 0 });
window.__PROTOS__ = data.protos;
state.P = { name: data.slug };
state.S = { active: data.slug };

// Documentacao embutida (so a que esta na pasta do pacote); o link direto e o hash #doc/<caminho>#<ancora>.
setDocsSource(embeddedDocsSource(data.docs));
setDocsLinkMode("hash");
dls.docsRefs = data.docs && data.docs.refs && data.docs.refs.found ? data.docs.refs : null;

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
  if (location.hash.startsWith("#doc/")) {
    openDocFromLocation();
    return;
  }
  const [screenId, fieldId] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (screenId && screens.some((s) => s.id === screenId)) window.openLayersTarget(screenId, fieldId || null);
}
// A primeira renderizacao ja abre o #doc/ do endereco (design-layers-workspace.js).
renderLayersWorkspace(container, data.slug, data.screensData);
if (!location.hash.startsWith("#doc/")) applyHash();
window.addEventListener("hashchange", applyHash);
