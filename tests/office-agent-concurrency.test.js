// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { officeAgentState } from "../ui/public/js/office/office-agent-state.js";
import { bindChatExecutionTelemetry } from "../ui/public/js/office/office-agent-telemetry.js";
import {
  countActiveByEngine,
  resetChatExecution,
  setChatAbortController,
  setChatExecutionStatus,
  setChatStreaming
} from "../ui/public/js/modules/chat-execution-store.js";

const SLUG = "harness-leca";

function setup(tag) {
  officeAgentState.reset();
  const unbind = bindChatExecutionTelemetry();
  const a = `${tag}-a-${Date.now()}`;
  const b = `${tag}-b-${Date.now()}`;
  const cleanup = () => {
    unbind();
    resetChatExecution(SLUG, a);
    resetChatExecution(SLUG, b);
  };
  return { a, b, cleanup };
}

const claude = () => officeAgentState.getAgentState("claude");

test("A3: two Claude chats, one finishes, engine stays active with count 1", () => {
  const { a, b, cleanup } = setup("fin");
  setChatStreaming(SLUG, a, true, "claude");
  setChatStreaming(SLUG, b, true, "claude");
  assert.equal(claude().activeCount, 2);

  setChatStreaming(SLUG, a, false);
  assert.equal(claude().status, "streaming");
  assert.equal(claude().activeCount, 1);

  setChatStreaming(SLUG, b, false);
  assert.equal(claude().status, "idle");
  assert.equal(claude().activeCount, 0);
  cleanup();
});

test("A3: error in one chat does not hide the other working chat", () => {
  const { a, b, cleanup } = setup("err");
  setChatStreaming(SLUG, a, true, "claude");
  setChatStreaming(SLUG, b, true, "claude");

  setChatExecutionStatus(SLUG, a, "error", "boom");
  assert.equal(claude().status, "streaming");
  assert.equal(claude().activeCount, 1);

  setChatExecutionStatus(SLUG, b, "error", "boom");
  assert.equal(claude().status, "error");
  assert.equal(claude().activeCount, 0);
  cleanup();
});

test("A3: resetChatExecution notifies so the engine is recomputed", () => {
  const { a, b, cleanup } = setup("rst");
  setChatStreaming(SLUG, a, true, "claude");
  setChatStreaming(SLUG, b, true, "claude");

  resetChatExecution(SLUG, a);
  assert.equal(claude().activeCount, 1);
  assert.equal(countActiveByEngine("claude").count, 1);

  resetChatExecution(SLUG, b);
  assert.equal(claude().status, "idle");
  assert.equal(claude().activeCount, 0);
  cleanup();
});

test("A3: engines are counted independently", () => {
  const { a, b, cleanup } = setup("ind");
  setChatStreaming(SLUG, a, true, "claude");
  setChatStreaming(SLUG, b, true, "gemini");
  setChatStreaming(SLUG, a, false);
  assert.equal(claude().status, "idle");
  assert.equal(officeAgentState.getAgentState("gemini").activeCount, 1);
  cleanup();
});

test("A3: compare mode lights every compared engine via controller keys", () => {
  const { a, cleanup } = setup("cmp");
  setChatStreaming(SLUG, a, true, "compare");
  setChatAbortController(SLUG, a, "claude", new AbortController());
  setChatAbortController(SLUG, a, "codex", new AbortController());
  assert.equal(claude().status, "streaming");
  assert.equal(officeAgentState.getAgentState("codex").activeCount, 1);

  setChatAbortController(SLUG, a, "claude", null);
  assert.equal(claude().status, "idle");
  assert.equal(officeAgentState.getAgentState("codex").status, "streaming");

  setChatStreaming(SLUG, a, false);
  setChatAbortController(SLUG, a, "codex", null);
  assert.equal(officeAgentState.getAgentState("codex").status, "idle");
  cleanup();
});
