// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../ui/public/js/modules/${path}`, import.meta.url), "utf8");

const classes = new Set(["studio-chat-minimized"]);
const workspace = { id: "studioWorkspace", prepend(el) { el.parentElement = workspace; } };
const host = {
  id: "atelierChatHost",
  contains(el) { return el.parentElement === host; },
  appendChild(el) { el.parentElement = host; },
};
const sidebar = { id: "studioSidebar", parentElement: host };
const byId = { studioWorkspace: workspace, studioSidebar: sidebar, atelierChatHost: host };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
globalThis.document = {
  body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); } } },
  getElementById: (id) => byId[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.addEventListener = () => {};

const { attachStudioSidebarToAtelier, detachStudioSidebarFromAtelier, isSidebarInAtelier } = await import(
  "../ui/public/js/modules/prototype-atelier-sidebar.js"
);

test("Ateliê: sair/recarregar devolve o chat ao Studio e limpa o minimizado", () => {
  classes.add("studio-chat-minimized");
  detachStudioSidebarFromAtelier();
  assert.equal(sidebar.parentElement, workspace, "Chat volta ao Studio antes do innerHTML do Ateliê");
  assert.equal(classes.has("studio-chat-minimized"), false, "Minimizado do Ateliê não vaza para o Studio");
});

test("Ateliê: reanexa o chat mesmo se ele saiu do documento num re-render", () => {
  attachStudioSidebarToAtelier();
  assert.equal(sidebar.parentElement, host);
  assert.equal(isSidebarInAtelier(), true);

  // Simula um innerHTML que arrancou o chat do documento: getElementById não o acha mais.
  byId.studioSidebar = null;
  detachStudioSidebarFromAtelier();
  assert.equal(sidebar.parentElement, workspace, "A referência guardada recupera o chat");

  attachStudioSidebarToAtelier();
  assert.equal(sidebar.parentElement, host, "O chat volta ao Ateliê sem sumir");
});

test("Ateliê: aplicar arquivos atualiza a tela sem reescrever o layout inteiro", () => {
  const src = read("prototype-atelier.js");
  assert.match(src, /reload: \(\) => void refreshAtelierPreview\(\)/);
  assert.doesNotMatch(src, /reload: \(\) => renderPrototypeAtelier/);
  assert.match(src, /atelierProtoVersionBadge/);
});

test("Sair do Ateliê devolve o chat e desliga o contexto do protótipo", () => {
  const views = read("studio-views.js");
  assert.match(views, /detachStudioSidebarFromAtelier\(\)/);
  const design = read("design.js");
  assert.match(design, /setAtelierChatContext\(null\)/);
});
