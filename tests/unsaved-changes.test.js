import test from "node:test";
import assert from "node:assert/strict";
import {
  UNSAVED_CHANGES_ERROR,
  UnsavedChangesRegistry,
} from "../ui/public/js/shared/unsaved-changes.js";

test("registro publica, filtra e limpa alterações não salvas", () => {
  const registry = new UnsavedChangesRegistry();
  const snapshots = [];
  const unsubscribe = registry.subscribe((changes) => snapshots.push(changes));

  registry.mark("studio:source", { label: "Fonte do Studio", projectSlug: "Projeto-A" });
  registry.mark("global:draft", { label: "Rascunho global" });

  assert.equal(registry.hasChanges({ projectSlug: "projeto-a" }), true);
  assert.deepEqual(
    registry.list({ projectSlug: "Projeto-B" }).map(({ id }) => id),
    ["global:draft"]
  );
  assert.equal(snapshots.length, 2);
  assert.equal(registry.clear("studio:source"), true);
  assert.equal(registry.clear("studio:source"), false);
  unsubscribe();
  registry.reset();
  assert.equal(snapshots.length, 3);
});

test("guard retorna erro estruturado com os bloqueadores", () => {
  const registry = new UnsavedChangesRegistry();
  const entry = registry.mark("editor:story", {
    label: "História em edição",
    projectSlug: "Projeto-A",
    workspaceId: "scrum"
  });

  assert.throws(
    () => registry.assertCanTransition({ projectSlug: "Projeto-A", workspaceId: "scrum" }),
    (error) => {
      assert.equal(error.code, UNSAVED_CHANGES_ERROR);
      assert.deepEqual(error.blockers, [entry]);
      return true;
    }
  );
  assert.doesNotThrow(() => (
    registry.assertCanTransition({ projectSlug: "Projeto-A", workspaceId: "dev" })
  ));
});

test("registro rejeita fontes sem identidade legível", () => {
  const registry = new UnsavedChangesRegistry();
  assert.throws(() => registry.mark("", { label: "Editor" }), /id e label/);
  assert.throws(() => registry.mark("editor", { label: "" }), /id e label/);
});
