// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeJiraSnapshot,
} = require("../ui/server/services/project-scrum-jira-source");
const {
  parseStoryDocument,
} = require("../ui/server/services/project-scrum-doc-source");
const {
  resolveScrumData,
} = require("../ui/server/services/project-scrum-resolver");

const jiraIssues = [
  {
    id: "1030000",
    key: "DIS-432",
    fields: {
      summary: "Modelo quantitativo explícito",
      issuetype: { id: "10000", name: "Épico", subtask: false },
      status: { id: "12322", name: "Desenvolvimento", statusCategory: { key: "indeterminate" } },
      issuelinks: [],
      customfield_10101: null,
    },
  },
  {
    id: "1034047",
    key: "DIS-499",
    fields: {
      summary: "Balcão: quanto a entrega precisa e o que sai para o paciente",
      issuetype: { id: "11717", name: "História", subtask: false },
      status: { id: "12321", name: "SELECIONADO", statusCategory: { key: "indeterminate" } },
      customfield_10101: "DIS-432",
      issuelinks: [
        {
          type: { id: "10000", name: "Blocks", inward: "is blocked by", outward: "blocks" },
          inwardIssue: { id: "1015847", key: "DIS-478", fields: { summary: "Retirada parcial" } },
        },
      ],
    },
  },
];

test("normaliza o snapshot Jira sem inventar campos ausentes", () => {
  const snapshot = normalizeJiraSnapshot(jiraIssues, {
    file: "doc/scrum/_jira-dis.json",
    exportedAt: "2026-10-14T13:54:31.464Z",
  });
  const story = snapshot.stories.find((item) => item.key === "DIS-499");

  assert.equal(snapshot.epics.length, 1);
  assert.equal(story.title, jiraIssues[1].fields.summary);
  assert.equal(story.epicId, "DIS-432");
  assert.equal(story.sourceStatus.name, "SELECIONADO");
  assert.equal(story.relationships[0].direction, "inward");
  assert.equal(story.relationships[0].issue.key, "DIS-478");
  assert.equal(story.points, null);
  assert.equal(story.priority, null);
  assert.equal(story.assignee, null);
  assert.equal(story.description, null);
  assert.deepEqual(story.acceptanceCriteria, []);
});

test("preserva a ordem dos critérios e cenários da documentação local", () => {
  const markdown = [
    "# DIS-499 Balcão",
    "",
    "## Contexto",
    "",
    "Contexto clínico e operacional do balcão.",
    "",
    "## Descrição",
    "",
    "Descrição completa com [DIS-496](../DIS-496/user-story.md).",
    "",
    "## História de Usuário",
    "",
    "- Como dispensador",
    "- Quero liberar as embalagens",
    "- Para atender o paciente",
    "",
    "## Critérios de Aceitação",
    "",
    "- **Critério 1**: Primeiro critério.",
    "  - Passo interno preservado.",
    "- **Critério 2**: Segundo critério.",
    "",
    "## Cenários de Testes Automatizados",
    "",
    "### Cenário 1: Caminho feliz",
    "",
    "- **Dado que** existe uma entrega",
    "- **Então** ela é exibida",
    "",
    "### Cenário 2: Falha",
    "",
    "- **Dado que** falta um valor",
    "- **Então** a operação é bloqueada",
    "",
    "## Fora do Escopo",
    "",
    "- Longa permanência.",
    "",
    "## Informações Adicionais",
    "",
    "- Usa DIS-496 e registra DIS-457.",
  ].join("\n");

  const doc = parseStoryDocument(markdown, { key: "DIS-499", file: "doc/scrum/DIS-499/user-story.md" });

  assert.equal(doc.context, "Contexto clínico e operacional do balcão.");
  assert.match(doc.description, /Descrição completa/);
  assert.match(doc.userStory, /Como dispensador/);
  assert.deepEqual(doc.acceptanceCriteria.map((item) => item.label), ["Critério 1", "Critério 2"]);
  assert.match(doc.acceptanceCriteria[0].content, /Passo interno preservado/);
  assert.deepEqual(doc.scenarios.map((item) => item.title), ["Cenário 1: Caminho feliz", "Cenário 2: Falha"]);
  assert.equal(doc.outOfScope, "- Longa permanência.");
  assert.equal(doc.additionalInfo, "- Usa DIS-496 e registra DIS-457.");
  assert.equal(doc.documentLinks[0].key, "DIS-496");
});

test("funde Jira, documentação e estado local sem conservar defaults fabricados", () => {
  const snapshot = normalizeJiraSnapshot(jiraIssues, { exportedAt: "2026-10-14T13:54:31.464Z" });
  const docs = new Map([
    ["DIS-499", {
      key: "DIS-499",
      context: "Contexto documentado.",
      description: "Descrição documentada.",
      userStory: "História documentada.",
      acceptanceCriteria: [{ id: "criterion-1", label: "Critério 1", content: "Valor real." }],
      scenarios: [{ id: "scenario-1", title: "Cenário 1", content: "Dado e então." }],
      outOfScope: "Fora de escopo documentado.",
      additionalInfo: "Info adicional documentada.",
      documentLinks: [],
      sourceFile: "doc/scrum/DIS-499/user-story.md",
    }],
  ]);
  const local = {
    schemaVersion: 2,
    migrationHistory: [{ id: "scrum-status-v1-to-v2" }],
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [],
    stories: [{
      id: "dis-499",
      key: "DIS-499",
      sprintId: "sprint-1",
      status: "in_progress",
      points: 3,
      priority: "media",
      assignee: "fullstack-engineer",
      acceptanceCriteria: ["Critério 1: Validar regras", "Critério 2: Garantir cobertura"],
    }],
  };

  const scrum = resolveScrumData(local, snapshot, docs);
  const story = scrum.stories.find((item) => item.key === "DIS-499");

  assert.equal(story.sprintId, "sprint-1");
  assert.equal(story.status, "in_progress");
  assert.equal(story.points, null);
  assert.equal(story.priority, null);
  assert.equal(story.assignee, null);
  assert.equal(story.context, "Contexto documentado.");
  assert.equal(story.description, "Descrição documentada.");
  assert.equal(story.userStory, "História documentada.");
  assert.equal(story.outOfScope, "Fora de escopo documentado.");
  assert.equal(story.additionalInfo, "Info adicional documentada.");
  assert.equal(story.acceptanceCriteria[0].content, "Valor real.");
  assert.equal(story.acceptanceCriteriaCount, 1);
  assert.equal(story.scenarioCount, 1);
  assert.equal(story.provenance.context, "documentation");
  assert.equal(story.provenance.description, "documentation");
  assert.equal(story.provenance.userStory, "documentation");
  assert.equal(story.provenance.outOfScope, "documentation");
  assert.equal(story.provenance.additionalInfo, "documentation");
  assert.equal(scrum.schemaVersion, 2);
  assert.equal(scrum.migrationHistory[0].id, "scrum-status-v1-to-v2");
});

test("mapeamento legado de status vira laneId sem substituir o status de origem", () => {
  const snapshot = normalizeJiraSnapshot(jiraIssues);
  const scrum = resolveScrumData({
    schemaVersion: 2,
    sprints: [],
    epics: [],
    stories: [],
    statusMapping: { "12321": "review" },
  }, snapshot, new Map());
  const story = scrum.stories.find((item) => item.key === "DIS-499");

  assert.equal(story.status, "in_progress");
  assert.equal(story.laneId, "em-revisao");
  assert.equal(scrum.statusMapping["12321"], "em-revisao");
  assert.equal(scrum.lanes.length, 12);
});
