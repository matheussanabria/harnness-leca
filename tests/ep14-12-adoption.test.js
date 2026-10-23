// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  artifactsPatch,
  normalizeArtifactsState,
  readArtifactsState,
} = await import("../ui/public/js/modules/design-artifacts-state.js");
const {
  normalizeRoutinesState,
  readRoutinesState,
  routinesPatch,
} = await import("../ui/public/js/modules/design-routines-state.js");
const { restoredDesignState, validDesignView } = await import(
  "../ui/public/js/modules/design-view-state.js"
);
const { hydrateSkillsState, normalizeSkillsState } = await import(
  "../ui/public/js/modules/skills-state.js"
);
const { sks } = await import("../ui/public/js/modules/skills-store.js");
const { hydrateCanvasDocs, memoryStorage, storageKey } = await import(
  "../ui/public/js/modules/prototype-canvas/canvas-store.js"
);
const {
  bindOfficeSessionClient,
  hydrateOfficeSession,
  officeSessionStorage,
} = await import("../ui/public/js/office/office-session-storage.js");

test("EP-14.12: Design restaura view valida e se estava aberto", async () => {
  const client = {
    loadScreen: async (id) => {
      assert.equal(id, "studio");
      return { designView: "artifacts", designOpen: true };
    },
  };
  assert.deepEqual(await restoredDesignState({ client }), { view: "artifacts", open: true });
  assert.equal(validDesignView("unknown"), "");
  const closed = { loadScreen: async () => ({ designView: "board" }) };
  assert.deepEqual(await restoredDesignState({ client: closed }), { view: "board", open: false });
});

test("EP-14.12: Artefatos normaliza, faz patch seletivo e le do estado", async () => {
  const state = normalizeArtifactsState({ kindFilter: "screen", sortAsc: true, selectedKey: "a" });
  assert.equal(state.kindFilter, "screen");
  assert.equal(state.sortField, "title");
  assert.equal(state.sortAsc, true);
  assert.deepEqual(artifactsPatch({ query: "DIS" }), { query: "DIS" });
  assert.deepEqual(artifactsPatch({}), {});
  const client = { loadScreen: async () => ({ kindFilter: "flow", query: "x" }) };
  assert.equal((await readArtifactsState({ client })).kindFilter, "flow");
});

test("EP-14.12: Rotinas normaliza aprovacao, patch e le do estado", async () => {
  const state = normalizeRoutinesState({ approvalFilter: "pending", tab: "history" });
  assert.equal(state.approvalFilter, "pending");
  assert.equal(state.tab, "history");
  assert.equal(normalizeRoutinesState({ approvalFilter: "bad" }).approvalFilter, "all");
  assert.deepEqual(routinesPatch({ selectedRoutine: "sync" }), { selectedRoutine: "sync" });
  assert.deepEqual(routinesPatch({}), {});
  const client = { loadScreen: async () => ({ filter: "sync", approvalFilter: "pending" }) };
  assert.equal((await readRoutinesState({ client })).filter, "sync");
});

test("EP-14.12: Skills hidrata aba e filtros no estado de Conversas", async () => {
  assert.deepEqual(normalizeSkillsState({}), { subTab: "md", importFilter: "", importSource: "all" });
  const client = {
    loadScreen: async (id) => {
      assert.equal(id, "chats");
      return { skillSubTab: "refs", skillImportFilter: "Angular", skillImportSource: "project" };
    },
  };
  const state = await hydrateSkillsState({ client });
  assert.equal(state.subTab, "refs");
  assert.equal(sks.currentSkillSubTab, "refs");
  assert.equal(sks.currentImportFilterText, "angular");
  assert.equal(sks.currentImportSourceFilter, "project");
});

test("EP-14.12: Canvas hidrata somente documentos do prefixo esperado", () => {
  const key = storageKey("projeto", "proto");
  hydrateCanvasDocs({ [key]: "{\"root\":{}}", "outra": "x", "harness.canvas.v1.x": 3 });
  assert.equal(memoryStorage.getItem(key), "{\"root\":{}}");
  assert.equal(memoryStorage.getItem("outra"), null);
  assert.equal(memoryStorage.getItem("harness.canvas.v1.x"), null);
});

test("EP-14.12: Office grava layout, estado e workspaces pela tela office", async () => {
  const patches = [];
  bindOfficeSessionClient({
    patchScreen: async (id, patch) => {
      patches.push({ id, patch });
      return patch;
    },
  });
  const saved = hydrateOfficeSession({
    windowLayout: { "dai:wm:layout:p": "layout" },
    windowState: { "dai:wm:state:p": "state" },
    workspaces: { "dai:wm:workspaces:p": "presets" },
  });
  assert.equal(saved, 3);
  officeSessionStorage.setItem("dai:wm:layout:q", "layout-q");
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, "office");
  assert.equal(patches[0].patch.windowLayout["dai:wm:layout:q"], "layout-q");
  assert.equal(patches[0].patch.windowLayout["dai:wm:layout:p"], "layout");
  assert.equal(patches[0].patch.windowState["dai:wm:state:p"], "state");
  assert.equal(patches[0].patch.workspaces["dai:wm:workspaces:p"], "presets");
});

test("EP-14.12: diario.html usa o modulo e nao tem script embutido", async () => {
  const html = await readFile(new URL("../ui/public/diario.html", import.meta.url), "utf8");
  const page = await readFile(
    new URL("../ui/public/js/modules/diario-page.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /diario-page\.js/);
  assert.match(page, /diario-state\.js/);
  assert.doesNotMatch(page, /localStorage/);
});
