const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

test("ui:dev usa node --watch (sem dependência) e só observa caminhos que existem", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const script = pkg.scripts["ui:dev"];
  assert.ok(script, "script ui:dev ausente");
  assert.ok(script.startsWith("node "), "deve usar o node direto");
  assert.ok(!/nodemon/.test(script), "sem dependência externa");
  assert.ok(script.endsWith("ui/server.js"), "entrada do servidor");
  const watched = [...script.matchAll(/--watch-path=(\S+)/g)].map((m) => m[1]);
  assert.ok(watched.length > 0);
  for (const p of watched) assert.ok(fs.existsSync(path.join(root, p)), `${p} não existe`);
  assert.ok(!watched.some((p) => p.startsWith("projects") || p.startsWith("ui/public")), "não deve reiniciar por dados ou front-end");
});

test("ui:dev:remote observa os mesmos caminhos e liga o modo remoto", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const dev = pkg.scripts["ui:dev"];
  const remote = pkg.scripts["ui:dev:remote"];
  assert.ok(remote, "script ui:dev:remote ausente");
  assert.ok(remote.startsWith(dev), "deve reaproveitar o ui:dev");
  assert.ok(/--remote\s*$/.test(remote), "deve terminar com --remote para aceitar --pin depois");
  assert.ok(!/--pin/.test(remote), "PIN é escolhido por quem executa");
});
