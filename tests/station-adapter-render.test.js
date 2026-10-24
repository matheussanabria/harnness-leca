// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import {
  createStationRenderer,
  resolveStationObjectId
} from "../ui/public/js/window-manager/station-adapter.js";

function windowState(activeWindowId, windows) {
  return { activeWindowId, windows };
}

test("resolveStationObjectId prefere o resourceId e trata janela de chat", () => {
  assert.equal(resolveStationObjectId({ moduleId: "gemini", resourceId: "gemini_desk" }), "gemini_desk");
  assert.equal(resolveStationObjectId({ moduleId: "chat", resourceId: "chat-1.md" }), "office_chat");
  assert.equal(resolveStationObjectId({ moduleId: "scrum" }), "scrum");
  assert.equal(resolveStationObjectId(null), null);
});

test("station renderer re-renderiza apenas quando o id da janela ativa muda", () => {
  const calls = [];
  const officeState = { activeProject: "projeto-a" };
  const renderer = createStationRenderer({
    officeState,
    renderDrawerContent: (objectId, state) => calls.push({ objectId, state })
  });

  const gemini = {
    id: "win-gemini",
    moduleId: "gemini",
    resourceId: "gemini_desk",
    visibility: "visible"
  };
  const scrum = {
    id: "win-scrum",
    moduleId: "scrum",
    resourceId: "whiteboard",
    visibility: "visible"
  };

  assert.equal(renderer.sync(windowState("win-gemini", [gemini])), true);
  assert.deepEqual(calls.map((call) => call.objectId), ["gemini_desk"]);
  assert.equal(calls[0].state, officeState);

  assert.equal(renderer.sync(windowState("win-gemini", [gemini])), false);
  assert.equal(calls.length, 1, "mesmo id não deve re-renderizar");

  assert.equal(renderer.sync(windowState("win-scrum", [gemini, scrum])), true);
  assert.deepEqual(calls.map((call) => call.objectId), ["gemini_desk", "whiteboard"]);

  renderer.reset();
  assert.equal(renderer.getRenderedWindowId(), null);
});

test("station renderer ignora janela minimizada e volta a renderizar ao restaurar", () => {
  const calls = [];
  const renderer = createStationRenderer({
    officeState: {},
    renderDrawerContent: (objectId) => calls.push(objectId)
  });
  const win = {
    id: "win-claude",
    moduleId: "claude",
    resourceId: "claude_desk",
    visibility: "minimized"
  };

  assert.equal(renderer.sync(windowState("win-claude", [win])), false);
  assert.equal(calls.length, 0);

  win.visibility = "visible";
  assert.equal(renderer.sync(windowState("win-claude", [win])), true);
  assert.deepEqual(calls, ["claude_desk"]);
});
