const test = require("node:test");
const assert = require("node:assert/strict");
const { parseStoryDocument } = require("../ui/server/services/project-scrum-doc-source");

test("CP-01: exported criteria and emphasized scenarios retain their bodies", () => {
  const doc = parseStoryDocument([
    "## Descrição", "Description.", "### Contexto", "Context.",
    "## Critérios de Aceitação", "- **Critério 1:** First.",
    "  - Nested detail.", "- **Critério 2**: Second.",
    "## Cenários de Testes Automatizados", "***Cenário: Success***",
    "**Dado que** ready", "**Então** succeeds", "----",
    "***Cenário: Failure***", "**Então** rejected",
  ].join("\n"));
  assert.equal(doc.description, "Description.");
  assert.equal(doc.context, "Context.");
  assert.deepEqual(doc.acceptanceCriteria.map(c => c.label), ["Critério 1", "Critério 2"]);
  assert.equal(doc.acceptanceCriteria[0].content, "First.\n  - Nested detail.");
  assert.deepEqual(doc.scenarios.map(s => s.title), ["Cenário: Success", "Cenário: Failure"]);
  assert.equal(doc.scenarios[0].content, "**Dado que** ready\n**Então** succeeds");
});

test("CP-02: numbered criteria and bold section headings are recognized", () => {
  const doc = parseStoryDocument([
    "**Descrição:**", "Description.", "**História de usuário:**", "- Como user",
    "**Caminho até a tela (opcional):**", "Menu > Screen",
    "**Critérios de Aceitação:**", "1. First.", "   1. Nested.", "1. **Second**.",
    "## Cenários de Testes Automatizados", "### Cenário 1: Works", "Then works.",
    "## Comentários e Histórico de Decisões", "### Comment", "Not a scenario.",
  ].join("\n"));
  assert.equal(doc.description, "Description.");
  assert.equal(doc.userStory, "- Como user");
  assert.deepEqual(doc.acceptanceCriteria.map(c => c.content), ["First.\n   1. Nested.", "**Second**."]);
  assert.equal(doc.scenarios.length, 1);
  assert.equal(doc.scenarios[0].content, "Then works.");
});

test("CP-03: unstructured descriptions exclude export metadata and comments", () => {
  const doc = parseStoryDocument("# DIS-1 Title\n\n- **Tipo**: História\n\n---\n\nOriginal body.\n\n---\n\n## Comentários e Histórico de Decisões\nComment.");
  assert.equal(doc.description, "Original body.");
  assert.deepEqual(doc.acceptanceCriteria, []);
  assert.deepEqual(doc.scenarios, []);
  assert.equal(parseStoryDocument("").description, null);
  assert.deepEqual(parseStoryDocument("## Critérios de Aceitação\nNo list provided.").acceptanceCriteria, []);
});
