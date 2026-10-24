// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUnsavedChoice,
  guardUnsavedTransition,
  resetUnsavedDialogPresenter,
  setUnsavedDialogPresenter
} from "../ui/public/js/shared/unsaved-dialog.js";
import { UnsavedChangesError } from "../ui/public/js/shared/unsaved-changes.js";

const blockers = [{ id: "studio-source", label: "Código do Studio" }];

test("applyUnsavedChoice mapeia cancelar, descartar e salvar", async () => {
  const cleared = [];
  assert.equal(await applyUnsavedChoice("cancel", { blockers, clear: (id) => cleared.push(id) }), false);
  assert.deepEqual(cleared, []);

  assert.equal(await applyUnsavedChoice("discard", { blockers, clear: (id) => cleared.push(id) }), true);
  assert.deepEqual(cleared, ["studio-source"]);

  let saved = 0;
  assert.equal(await applyUnsavedChoice("save", { blockers, save: () => { saved += 1; } }), true);
  assert.equal(saved, 1);
  assert.equal(await applyUnsavedChoice("save", { blockers }), false, "sem handler de salvar não prossegue");
});

test("guardUnsavedTransition reexecuta a transição com force após descartar", async () => {
  const calls = [];
  let decision = "discard";
  const cleared = [];
  const transition = async ({ force }) => {
    calls.push(force);
    if (!force) throw new UnsavedChangesError(blockers);
    return "ok";
  };

  const result = await guardUnsavedTransition(transition, {
    clear: (id) => cleared.push(id),
    requestDecision: async () => decision
  });

  assert.equal(result, "ok");
  assert.deepEqual(calls, [false, true]);
  assert.deepEqual(cleared, ["studio-source"]);

  calls.length = 0;
  decision = "cancel";
  assert.equal(await guardUnsavedTransition(transition, { requestDecision: async () => decision }), false);
  assert.deepEqual(calls, [false], "cancelar não reexecuta a transição");
});

test("guardUnsavedTransition salva antes de prosseguir e propaga erros comuns", async () => {
  const order = [];
  const transition = async ({ force }) => {
    order.push(force ? "retry" : "first");
    if (!force) throw new UnsavedChangesError(blockers);
    return true;
  };

  const result = await guardUnsavedTransition(transition, {
    save: async () => { order.push("save"); },
    requestDecision: async () => "save"
  });

  assert.equal(result, true);
  assert.deepEqual(order, ["first", "save", "retry"]);

  await assert.rejects(
    () => guardUnsavedTransition(async () => { throw new Error("boom"); }),
    /boom/
  );
});

test("requestUnsavedResolution usa o presenter injetado", async () => {
  setUnsavedDialogPresenter(async () => "discard");
  const { requestUnsavedResolution } = await import("../ui/public/js/shared/unsaved-dialog.js");
  assert.equal(await requestUnsavedResolution({ blockers }), "discard");
  resetUnsavedDialogPresenter();
});
