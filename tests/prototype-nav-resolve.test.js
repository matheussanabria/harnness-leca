const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-nav-resolve.js")).href);
const resolve = async (target, ids = ["orbit", "home"]) => (await load()).resolveScreenTarget(target, ids);

test("resolveScreenTarget: todos os formatos do gerador devolvem o mesmo ID", async () => {
  for (const target of ["goto:orbit", "screens/orbit.html", "./screens/orbit.html", "orbit.html", "orbit"]) {
    assert.deepEqual(await resolve(target), { kind: "screen", screen: "orbit" }, target);
  }
});

test("resolveScreenTarget: fragmento e query são descartados em qualquer formato", async () => {
  for (const target of [
    "goto:orbit#topo",
    "screens/orbit.html#topo",
    "./screens/orbit.html?tema=escuro",
    "orbit.html?tema=escuro#topo",
    "orbit?tema=escuro",
    "orbit#topo?tema=escuro",
  ]) {
    assert.deepEqual(await resolve(target), { kind: "screen", screen: "orbit" }, target);
  }
});

test("resolveScreenTarget: tela válida e ausente vira planejada", async () => {
  assert.deepEqual(await resolve("screens/checkout.html"), { kind: "planned", screen: "checkout" });
  assert.deepEqual(await resolve("Ajustes"), { kind: "planned", screen: "Ajustes" });
});

test("resolveScreenTarget: externos não viram tela", async () => {
  for (const target of ["https://exemplo.com/orbit", "http://exemplo.com", "HTTPS://EXEMPLO.COM", "mailto:time@exemplo.com", "tel:+5511999999999"]) {
    assert.deepEqual(await resolve(target), { kind: "external", screen: "" }, target);
  }
});

test("resolveScreenTarget: vazio, âncora e javascript não têm destino", async () => {
  for (const target of ["", "   ", "#", "#ancora", "javascript:alert(1)", "  javascript:void(0)  ", null, undefined, 42]) {
    assert.deepEqual(await resolve(target), { kind: "none", screen: "" }, String(target));
  }
});

test("resolveScreenTarget: formato de ID inválido vira none", async () => {
  for (const target of ["screens/minha tela.html", "goto:", "screens/.html", "../orbit", "orbit/extra", "orbit.js", "órbita", "?tema=escuro"]) {
    assert.deepEqual(await resolve(target), { kind: "none", screen: "" }, target);
  }
});

test("resolveScreenTarget: comparação de ID diferencia maiúsculas", async () => {
  assert.deepEqual(await resolve("Orbit", ["Orbit"]), { kind: "screen", screen: "Orbit" });
  assert.deepEqual(await resolve("orbit", ["Orbit"]), { kind: "planned", screen: "orbit" });
});

test("resolveScreenTarget: remove espaços das pontas", async () => {
  assert.deepEqual(await resolve("  goto:orbit  "), { kind: "screen", screen: "orbit" });
  assert.deepEqual(await resolve("  screens/home.html  "), { kind: "screen", screen: "home" });
});

test("resolveScreenTarget: aceita Set e não altera screenIds", async () => {
  assert.deepEqual(await resolve("orbit", new Set(["orbit"])), { kind: "screen", screen: "orbit" });
  const ids = Object.freeze(["orbit", "home"]);
  assert.deepEqual(await resolve("home", ids), { kind: "screen", screen: "home" });
  assert.deepEqual(ids, ["orbit", "home"]);
});
