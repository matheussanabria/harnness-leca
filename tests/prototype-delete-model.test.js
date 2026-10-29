const test = require("node:test");
const assert = require("node:assert/strict");

test("texto de confirmação nomeia o protótipo e explica a lixeira", async () => {
  const { deleteConfirmText } = await import("../ui/public/js/modules/prototype-delete-model.js");
  const a = deleteConfirmText({ id: "x", title: "Fluxo X", kind: "atelier" });
  assert.equal(a.title, 'Excluir "Fluxo X"?');
  assert.match(a.body, /lixeira/);
  const b = deleteConfirmText({ id: "art", kind: "artifact" });
  assert.equal(b.title, 'Excluir "art"?');
  assert.match(b.body, /não é apagado/);
});

test("depois de excluir: mantém o ativo, ou abre o vizinho, ou nada", async () => {
  const { pickAfterDelete } = await import("../ui/public/js/modules/prototype-delete-model.js");
  const cat = [{ id: "a", kind: "artifact" }, { id: "b", kind: "atelier" }, { id: "c", kind: "atelier" }];
  assert.deepEqual(pickAfterDelete(cat, "a", "c"), { id: "c", kind: "atelier" });
  assert.deepEqual(pickAfterDelete(cat, "b", "b"), { id: "c", kind: "atelier" });
  assert.deepEqual(pickAfterDelete(cat, "c", "c"), { id: "b", kind: "atelier" });
  assert.equal(pickAfterDelete([{ id: "a", kind: "artifact" }], "a", "a"), null);
});

test("URL de exclusão escapa o id", async () => {
  const { deleteUrl } = await import("../ui/public/js/modules/prototype-delete-model.js");
  assert.equal(deleteUrl("saude-dispensacao", "dis-paciente"), "/api/project/saude-dispensacao/design/prototypes/dis-paciente/delete");
});

test("catálogo não duplica protótipo do Ateliê que também está no design.json", async () => {
  const { buildPrototypeCatalog } = await import("../ui/public/js/modules/prototype-catalog.js");
  const catalog = buildPrototypeCatalog(
    [{ id: "externo" }, { id: "vitrine", file: "design/prototypes/vitrine/proto.json" }],
    [{ id: "vitrine", screens: [] }],
  );
  assert.deepEqual(catalog.map((i) => `${i.id}:${i.kind}`), ["externo:artifact", "vitrine:atelier"]);
});

test("catalog replaces a raw artifact with its executable inspection copy", async () => {
  const { buildPrototypeCatalog } = await import("../ui/public/js/modules/prototype-catalog.js");
  const catalog = buildPrototypeCatalog(
    [{ id: "design-system-v2", file: "design/prototypes/Design System v2.dc.html" }],
    [{ id: "design-system-v2-inspecao", metadata: { sourceArtifact: "design-system-v2", runtime: "dc" } }],
  );
  assert.deepEqual(catalog.map((i) => `${i.id}:${i.kind}`), ["design-system-v2-inspecao:atelier"]);
});
