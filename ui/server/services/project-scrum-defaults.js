// @ts-check
// Dados de Scrum padrão de um projeto novo.
const fs = require("fs");
const path = require("path");
const { getCanonicalLanes } = require("./project-scrum-lanes");

/**
 * Cria uma estrutura inicial de Scrum baseada nos dados e regras do projeto.
 * @param {string} slug
 * @param {string} projectDir
 * @param {string} repoRoot
 */
function createDefaultScrumData(slug, projectDir, repoRoot) {
  // Fontes externas sao reconciliadas na leitura, sem materializar defaults locais.
  const logicDir = path.resolve(repoRoot, "docs", "logic");
  const logicEpics = [];
  const logicStories = [];

  if (fs.existsSync(logicDir)) {
    try {
      const entries = fs.readdirSync(logicDir, { withFileTypes: true });
      let idx = 1;
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
        const pronKey = ent.name.toUpperCase();
        const epicId = `EPIC-${pronKey}`;
        logicEpics.push({
          id: epicId,
          title: `Épico ${pronKey}`,
          description: `Módulo e histórias de ${pronKey}`,
          color: ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"][idx % 5],
        });

        logicStories.push({
          id: pronKey.toLowerCase(),
          key: pronKey,
          title: `Implementação e Validação de ${pronKey}`,
          description: `História técnica e de negócio para o fluxo de ${pronKey}`,
          acceptanceCriteria: [
            "Critérios de aceite definidos em story/04-criteria-acceptance.md",
            "Cobertura de testes com Clean Architecture validada",
          ],
          epicId,
          sprintId: idx <= 3 ? "sprint-1" : null,
          status: idx === 1 ? "done" : (idx === 2 ? "in_progress" : "todo"),
          points: [3, 5, 8][idx % 3],
          priority: idx === 1 ? "alta" : "media",
          assignee: "backend-architect",
          updatedAt: new Date().toISOString(),
        });
        idx++;
      }
    } catch {}
  }

  if (logicStories.length > 0) {
    return {
      lanes: getCanonicalLanes(),
      lanesRevision: 0,
      transitionHistory: [],
      activeSprintId: "sprint-1",
      sprints: [
        {
          id: "sprint-1",
          name: "Sprint 1 — Core do Sistema",
          goal: "Entrega dos fluxos prioritários e regras de domínio",
          startDate: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
          endDate: new Date(Date.now() + 9 * 86400000).toISOString().split("T")[0],
          status: "active",
        },
      ],
      epics: logicEpics,
      stories: logicStories,
    };
  }

  // 3. Estrutura padrão limpa para qualquer outro projeto
  const prefix = slug.toUpperCase().slice(0, 4);
  const epics = [
    { id: "EPIC-1", title: "Arquitetura e Fundações", description: "Infraestrutura básica e modelos", color: "#6366f1" },
    { id: "EPIC-2", title: "Funcionalidades Principais", description: "Jornada essencial do usuário", color: "#10b981" },
    { id: "EPIC-3", title: "Qualidade, Testes & Auditoria", description: "Validação contínua e cobertura", color: "#f59e0b" },
  ];

  const stories = [
    {
      id: "us-101",
      key: `${prefix}-101`,
      title: "Configuração do ambiente e modelos centrais",
      description: `Como desenvolvedor, quero estruturar os modelos de ${slug} para suportar as regras de negócio.`,
      acceptanceCriteria: ["Modelos tipados e validados", "Regras essenciais documentadas"],
      epicId: "EPIC-1",
      sprintId: "sprint-1",
      status: "done",
      points: 3,
      priority: "alta",
      assignee: "backend-architect",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "us-102",
      key: `${prefix}-102`,
      title: "Interface de usuário e fluxo principal",
      description: `Como usuário, quero interagir com o fluxo principal para concluir as tarefas essenciais.`,
      acceptanceCriteria: ["Componentes responsivos e acessíveis", "Feedback visual para cada estado"],
      epicId: "EPIC-2",
      sprintId: "sprint-1",
      status: "in_progress",
      points: 5,
      priority: "alta",
      assignee: "frontend-engineer",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "us-103",
      key: `${prefix}-103`,
      title: "Cenários de teste e validação de regressão",
      description: `Como QA, quero cobrir o fluxo principal com testes automatizados para evitar regressões.`,
      acceptanceCriteria: ["Cenários BDD automatizados", "Sem falhas na suíte de testes"],
      epicId: "EPIC-3",
      sprintId: "sprint-1",
      status: "todo",
      points: 3,
      priority: "media",
      assignee: "qa-engineer",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "us-104",
      key: `${prefix}-104`,
      title: "Otimização de performance e auditoria de código",
      description: "Como arquiteto, quero auditar o projeto contra regras e convenções estritas.",
      acceptanceCriteria: ["Auditoria com score acima de 90%", "Sem violações de Clean Architecture"],
      epicId: "EPIC-3",
      sprintId: null, // no backlog
      status: "todo",
      points: 5,
      priority: "baixa",
      assignee: "code-reviewer",
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    lanes: getCanonicalLanes(),
    lanesRevision: 0,
    transitionHistory: [],
    activeSprintId: "sprint-1",
    sprints: [
      {
        id: "sprint-1",
        name: "Sprint 1 — MVP & Entrega Contínua",
        goal: `Implementar a primeira versão funcional do ${slug}`,
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        status: "active",
      },
    ],
    epics,
    stories,
  };
}

module.exports = { createDefaultScrumData };
