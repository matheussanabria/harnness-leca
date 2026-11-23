const test = require("node:test");
const assert = require("node:assert/strict");
const { validateManifest } = require("../ui/server/features/validate");
const { FEATURES, availability } = require("../ui/server/features/manifest");

const base = {
  id: "chat", titulo: "Chat", escopo: "optional", icone: "fa-solid fa-comments",
  rota: "/chat", janela: "chat", artefatos: [],
};

test("a well-formed feature is valid", () => {
  assert.deepEqual(validateManifest([base]), []);
});

test("rejects invalid scope, duplicate id and duplicate route", () => {
  const errors = validateManifest([base, { ...base, escopo: "tudo" }]);
  assert.ok(errors.some((e) => /escopo must be one of/.test(e)));
  assert.ok(errors.some((e) => /duplicate id/.test(e)));
  assert.ok(errors.some((e) => /duplicate rota/.test(e)));
});

test("rejects non-FontAwesome icons and emoji titles", () => {
  assert.ok(validateManifest([{ ...base, icone: "mdi-chat" }]).some((e) => /FontAwesome/.test(e)));
  assert.ok(validateManifest([{ ...base, titulo: "Chat \u{1F600}" }]).some((e) => /emoji/.test(e)));
});

test("rejects empty or non-array manifests", () => {
  assert.equal(validateManifest([]).length, 1);
  assert.equal(validateManifest(null).length, 1);
});

test("the shipped manifest is valid and covers all three scopes", () => {
  assert.deepEqual(validateManifest(FEATURES), []);
  for (const scope of ["project", "optional", "global"]) {
    assert.ok(FEATURES.some((f) => f.escopo === scope), `no feature with scope ${scope}`);
  }
});

test("availability: project-scope features need a project, others never do", () => {
  const without = availability(FEATURES, null);
  const withProject = availability(FEATURES, "meus-treinos");
  for (const f of without) {
    if (f.escopo === "project") {
      assert.equal(f.disponivel, false);
      assert.match(f.motivo, /projeto/i);
    } else {
      assert.equal(f.disponivel, true);
    }
  }
  assert.ok(withProject.every((f) => f.disponivel));
});
