// @ts-check
// Testes — Modelo da Central de Sessões (EP-09.03)

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const MODEL_PATH = path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-model.js");

async function loadModel() {
  return import(pathToFileURL(MODEL_PATH).href);
}

const SAMPLE = [
  {
    id: "s1",
    title: "Auditoria do quadro",
    primaryProvider: "claude",
    projectId: "saude-dispensacao",
    projectConfidence: "explicit",
    executionStatus: "running",
    workflowStatus: "running",
    attentionStatus: "none",
    lastObservedAt: "2026-10-21T10:00:00.000Z",
  },
  {
    id: "s2",
    title: "Deploy do protótipo",
    primaryProvider: "gemini",
    projectId: "saude-dispensacao",
    projectConfidence: "inferred",
    executionStatus: "failed",
    workflowStatus: "blocked",
    attentionStatus: "open",
    lastObservedAt: "2026-10-21T12:00:00.000Z",
  },
  {
    id: "s3",
    title: "Notas de reunião",
    primaryProvider: "opencode",
    projectId: null,
    projectConfidence: "unknown",
    executionStatus: "idle",
    workflowStatus: "none",
    attentionStatus: "none",
    lastObservedAt: "2026-10-20T09:00:00.000Z",
  },
];

test("Central - filtros combinam motor, estado, confiança, período e busca", async () => {
  const { filterSessions } = await loadModel();
  assert.equal(filterSessions(SAMPLE, {}).length, 3);
  assert.equal(filterSessions(SAMPLE, { provider: "claude" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { executionStatus: "failed" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { workflowStatus: "blocked" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { attentionStatus: "open" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { projectConfidence: "inferred" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { q: "protótipo" }).length, 1);
  assert.equal(filterSessions(SAMPLE, { since: "2026-10-21T00:00:00.000Z" }).length, 2);
  assert.equal(filterSessions(SAMPLE, { until: "2026-10-21T00:00:00.000Z" }).length, 1);
});

test("Central - a ordenação traz a observação mais recente primeiro", async () => {
  const { sortSessions } = await loadModel();
  const sorted = sortSessions(SAMPLE);
  assert.equal(sorted[0].id, "s2");
  assert.equal(sorted[2].id, "s3");
});

test("Central - as raias do Kanban seguem a ordem canônica e agrupam por estado", async () => {
  const { groupByLane, KANBAN_LANES } = await loadModel();
  const lanes = groupByLane(SAMPLE);
  const ids = lanes.map((lane) => lane.id);
  assert.deepEqual(ids.slice(0, 4), KANBAN_LANES.slice(0, 4).map((lane) => lane.id));
  const implementation = lanes.find((lane) => lane.id === "implementation");
  assert.equal(implementation.sessions.length, 1);
  assert.equal(implementation.sessions[0].id, "s1");
  const approval = lanes.find((lane) => lane.id === "approval");
  assert.equal(approval.sessions[0].id, "s2");
  const unclassified = lanes.find((lane) => lane.id === "unclassified");
  assert.equal(unclassified.sessions[0].id, "s3");
});

test("Central - o resumo conta sessões, atenção e vínculos inferidos", async () => {
  const { summarize } = await loadModel();
  const summary = summarize(SAMPLE);
  assert.equal(summary.total, 3);
  assert.equal(summary.attention, 1);
  assert.equal(summary.inferred, 1);
  assert.equal(summary.byProvider.claude, 1);
  assert.equal(summary.byWorkflow.running, 1);
});

test("Central - cada estado tem rótulo e ícone textual (nunca só cor)", async () => {
  const { describeSession, EXECUTION_STATUS, WORKFLOW_STATUS, ATTENTION_STATUS, CONFIDENCE } = await loadModel();
  const status = describeSession(SAMPLE[1]);
  assert.equal(status.execution.label, "Falhou");
  assert.equal(status.workflow.label, "Bloqueado");
  assert.equal(status.attention.label, "Atenção necessária");
  assert.equal(status.confidence.label, "inferido");
  for (const map of [EXECUTION_STATUS, WORKFLOW_STATUS, ATTENTION_STATUS, CONFIDENCE]) {
    for (const item of Object.values(map)) {
      assert.ok(item.label, "todo estado tem rótulo textual");
      assert.ok(item.icon.startsWith("fa-"), "todo estado tem icone FontAwesome");
    }
  }
});

test("Central - o formato de data é legível e tolerante a valor inválido", async () => {
  const { formatTimestamp } = await loadModel();
  assert.match(formatTimestamp("2026-10-21T10:00:00.000Z"), /2026/);
  assert.equal(formatTimestamp(""), "sem data");
  assert.equal(formatTimestamp("data-invalida"), "data-invalida");
});
