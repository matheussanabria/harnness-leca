// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const classes = new Set(["studio-chat-minimized"]);
const workspace = { id: "studioWorkspace", prepend(el) { el.parentElement = workspace; } };
const host = { id: "atelierChatHost" };
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

const { detachStudioSidebarFromAtelier } = await import("../ui/public/js/modules/prototype-atelier.js");

test("Ateliê: sair/recarregar devolve o chat ao Studio e limpa o minimizado", () => {
  detachStudioSidebarFromAtelier();
  assert.equal(sidebar.parentElement, workspace, "Chat volta ao Studio antes do innerHTML do Ateliê");
  assert.equal(classes.has("studio-chat-minimized"), false, "Minimizado do Ateliê não vaza para o Studio");
});
