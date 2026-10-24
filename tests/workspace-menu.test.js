// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const { workspaceMenuItems, normalizeWorkspaceName, WORKSPACE_NAME_MAX_LENGTH } = await import(
  "../ui/public/js/office/workspace-menu.js"
);
const { SYSTEM_WORKSPACES } = await import("../ui/public/js/window-manager/workspace-templates.js");

test("EP-01.11: menu lista os quatro templates e os layouts do projeto", () => {
  const custom = { id: "custom-qa", name: "qa", icon: "fa-solid fa-shapes", isSystem: false };
  const items = workspaceMenuItems([...SYSTEM_WORKSPACES, custom]);

  assert.equal(items.length, 5);
  assert.deepEqual(items.map((item) => item.id), ["dev", "scrum", "quality", "ops", "custom-qa"]);
  assert.equal(items.slice(0, 4).every((item) => item.deletable === false), true);
  assert.equal(items[4].deletable, true);
});

test("EP-01.11: templates do sistema não podem ser excluídos pelo menu", () => {
  for (const template of SYSTEM_WORKSPACES) {
    const [item] = workspaceMenuItems([template]);
    assert.equal(item.deletable, false, `${template.id} deve ser protegido`);
  }
});

test("EP-01.11: nome do workspace é aparado e limitado antes de salvar", () => {
  assert.equal(normalizeWorkspaceName("  QA  "), "QA");
  assert.equal(normalizeWorkspaceName(null), "");
  assert.equal(normalizeWorkspaceName("x".repeat(80)).length, WORKSPACE_NAME_MAX_LENGTH);
});
