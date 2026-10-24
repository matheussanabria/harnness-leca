// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import { formatEngineActivity } from "../ui/public/js/office/office-engine-activity-format.js";
import { summarizeEngine } from "../ui/public/js/office/office-engine-summary.js";
import { officeAgentState } from "../ui/public/js/office/office-agent-state.js";
import { renderOverviewTab } from "../ui/public/js/office3d/orchestration/tab-overview.js";
import { renderColumnAgents } from "../ui/public/js/office3d/war-screen/war-screen-agents.js";

test("dossier formatter: 0 never shows 1, shows standby wording", () => {
  for (const input of [undefined, null, {}, { activeCount: 0 }, { activeCount: undefined }, { activeCount: "x" }, { activeCount: -2 }]) {
    const f = formatEngineActivity(/** @type {any} */ (input));
    assert.equal(f.working, false);
    assert.equal(f.activeCount, 0);
    assert.doesNotMatch(f.headline, /1/);
    assert.match(f.headline, /espera/);
  }
});

test("dossier formatter: N running and M open are separate, residual task hidden when idle", () => {
  const busy = formatEngineActivity({ activeCount: 3, openCount: 2, currentTask: "x" });
  assert.equal(busy.headline, "3 em andamento");
  assert.equal(busy.openLine, "2 sessões abertas");
  assert.equal(busy.task, "x");
  assert.equal(formatEngineActivity({ openCount: 1 }).openLine, "1 sessão aberta");
  const idle = formatEngineActivity({ activeCount: 0, openCount: 4, currentTask: "stale text" });
  assert.deepEqual([idle.headline, idle.task, idle.openLine], ["Em espera (standby)", "", "4 sessões abertas"]);
});

test("summary: takes the larger of canonical state and running executions (no double count)", () => {
  const executions = [{ provider: "claude", status: "running" }, { provider: "claude", status: "completed" }];
  assert.equal(summarizeEngine("claude", { agentState: { activeCount: 0 }, executions }).activeCount, 1);
  assert.equal(summarizeEngine("claude", { agentState: { activeCount: 1 }, executions }).activeCount, 1);
  assert.equal(summarizeEngine("claude", { agentState: { activeCount: 2 }, executions }).activeCount, 2);
  assert.equal(summarizeEngine("gemini", { agentState: null, executions }).state, "integration");
  assert.equal(summarizeEngine("gemini", { agentState: { openCount: 2 }, executions: [] }).state, "open");
});

test("Central card: Claude is not STANDBY / 0 while a Claude execution is listed as running", () => {
  officeAgentState.reset();
  const orch = {
    integrations: { claude: { status: "unknown" }, gemini: { status: "unknown" }, opencode: { status: "unknown" } },
    executions: [{ id: "e1", provider: "claude", status: "running", title: "t" }]
  };
  const html = renderOverviewTab(orch, "p");
  const claudeCard = html.slice(html.indexOf("Claude Code"), html.indexOf("Gemini Antigravity"));
  assert.match(claudeCard, /ATIVO/);
  assert.doesNotMatch(claudeCard, /STANDBY/);
  assert.match(claudeCard, /Execuções: <b[^>]*>1</);
  const gemCard = html.slice(html.indexOf("Gemini Antigravity"), html.indexOf("OpenCode Lab"));
  assert.match(gemCard, /UNKNOWN|STANDBY/);
  assert.match(gemCard, /Execuções: <b[^>]*>0</);
});

test("Central card: projection-derived processing session and open sessions drive the card", () => {
  officeAgentState.reset();
  officeAgentState.setAgentState("claude", { status: "streaming", activeCount: 1, openCount: 2 });
  const html = renderOverviewTab({ integrations: {}, executions: [] }, "p");
  const claudeCard = html.slice(html.indexOf("Claude Code"), html.indexOf("Gemini Antigravity"));
  assert.match(claudeCard, /ATIVO/);
  assert.match(claudeCard, /2 abertas/);
  officeAgentState.reset();
});

test("War board: no invented counts and consistent with the canonical state", () => {
  officeAgentState.reset();
  /** @param {any} orch */
  const draw = (orch) => {
    const lines = [];
    const ctx = new Proxy({}, { get: (_t, k) => (k === "fillText" ? (s) => lines.push(String(s)) : () => {}), set: () => true });
    renderColumnAgents(/** @type {any} */ (ctx), 0, 0, 800, 900, {}, orch);
    return lines;
  };
  let lines = draw({ integrations: {}, executions: [] });
  assert.ok(lines.every((l) => !/1 execução detectada|2 execuções detectadas/.test(l)));
  assert.equal(lines.filter((l) => l === "Telemetria: Em espera").length, 3);
  officeAgentState.setAgentState("claude", { status: "streaming", activeCount: 1, openCount: 1 });
  lines = draw({ integrations: {}, executions: [] });
  assert.ok(lines.includes("Telemetria: 1 em andamento · 1 sessão aberta"));
  assert.ok(lines.includes("ATIVO"));
  officeAgentState.reset();
});
