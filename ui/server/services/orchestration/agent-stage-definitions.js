// @ts-check
// Definições canônicas das etapas do SDLC e dos agentes associados (EP-08.02).
// Fonte da verdade: dai/workflows/feature-delivery/WORKFLOW.md. Somente dados, sem I/O.

const DAI_AGENTS = Object.freeze([
  "ai-engineer",
  "backend-engineer",
  "business-analyst",
  "devops-engineer",
  "documentation-engineer",
  "frontend-engineer",
  "product-manager",
  "product-owner",
  "qa-engineer",
  "refactor-clean-code",
  "scrum-master",
  "sdd-agent",
  "security-engineer",
  "software-architect",
  "software-developer",
  "software-engineer",
  "ux-ui-designer",
]);

const BUILTIN_AGENTS = Object.freeze(["code-review"]);

const AGENT_LABELS = Object.freeze({
  "ai-engineer": "AI Engineer",
  "backend-engineer": "Backend Engineer",
  "business-analyst": "Business Analyst",
  "code-review": "Code Review (builtin)",
  "devops-engineer": "DevOps Engineer",
  "documentation-engineer": "Documentation Engineer",
  "frontend-engineer": "Frontend Engineer",
  "product-manager": "Product Manager",
  "product-owner": "Product Owner",
  "qa-engineer": "QA Engineer",
  "refactor-clean-code": "Refactor & Clean Code",
  "scrum-master": "Scrum Master",
  "sdd-agent": "SDD Agent",
  "security-engineer": "Security Engineer",
  "software-architect": "Software Architect",
  "software-developer": "Software Developer",
  "software-engineer": "Software Engineer",
  "ux-ui-designer": "UX/UI Designer",
});

const SESSION_EXECUTOR = "sessao";

function executor(id, required = true) {
  return { id, label: AGENT_LABELS[id] || id, role: "executor", required, builtin: BUILTIN_AGENTS.includes(id) };
}

function support(id) {
  return { id, label: AGENT_LABELS[id] || id, role: "support", required: false, builtin: BUILTIN_AGENTS.includes(id) };
}

const STAGES = Object.freeze([
  {
    id: "start",
    label: "Início",
    order: 0,
    executors: [SESSION_EXECUTOR],
    agents: [],
    skills: [],
    gate: "Dossiê criado (automático)",
    writes: ["_status.md"],
  },
  {
    id: "story",
    label: "História",
    order: 1,
    executors: ["business-analyst"],
    agents: [executor("business-analyst"), support("product-owner")],
    skills: ["requirements-engineering", "spec-templates", "product-discovery", "application-security"],
    gate: "Critérios de aceite verificáveis",
    writes: ["01-story.md"],
  },
  {
    id: "bdd",
    label: "BDD",
    order: 2,
    executors: ["qa-engineer"],
    agents: [executor("qa-engineer")],
    skills: ["bdd-scenarios", "api-security"],
    gate: "Checklist da bdd-scenarios; cenários negativos de autorização em features sensíveis",
    writes: ["02-bdd.feature"],
  },
  {
    id: "prototype",
    label: "Protótipo",
    order: 3,
    executors: ["ux-ui-designer"],
    agents: [executor("ux-ui-designer")],
    skills: ["ux-design-process", "spec-templates", "accessibility-audit"],
    gate: "Aprovação do protótipo",
    writes: ["03-prototipo.md"],
  },
  {
    id: "modeling",
    label: "Modelagem",
    order: 4,
    executors: ["software-architect"],
    agents: [executor("software-architect"), support("sdd-agent"), support("software-engineer"), support("security-engineer")],
    skills: [
      "software-architecture",
      "data-modeling",
      "spec-templates",
      "obsidian-feature-modeler",
      "layer-map-exporter",
      "software-design-document",
      "clean-architecture",
      "rest-api-design",
      "technical-breakdown",
      "application-security",
      "api-security",
    ],
    gate: "ADRs; threat model com risco residual e dono",
    writes: ["04-modelagem.md", "mapa-camadas.json"],
  },
  {
    id: "dev",
    label: "Desenvolvimento",
    order: 5,
    executors: ["software-developer"],
    agents: [executor("software-developer"), support("backend-engineer"), support("frontend-engineer")],
    skills: ["feature-implementation", "clean-code", "react-code-standards", "angular18-expert", "java"],
    gate: "Build + lint",
    writes: ["05-dev-notas.md", "código"],
  },
  {
    id: "tests",
    label: "Testes",
    order: 6,
    executors: ["qa-engineer"],
    agents: [executor("qa-engineer")],
    skills: ["test-planning", "tdd-test-driven", "accessibility-audit", "bug-reporting", "api-security"],
    gate: "Suíte verde; BDD coberto; testes negativos de autorização",
    writes: ["06-testes.md", "testes"],
  },
  {
    id: "review",
    label: "Revisão",
    order: 7,
    executors: ["code-review"],
    agents: [executor("code-review"), support("refactor-clean-code"), support("software-engineer"), support("security-engineer")],
    skills: [
      "code-review-checklist",
      "clean-code",
      "refactoring",
      "application-security",
      "api-security",
      "supply-chain-security",
    ],
    gate: "Sem finding bloqueante; OWASP 2025 nas features sensíveis",
    writes: ["07-code-review.md"],
  },
  {
    id: "commit-pr",
    label: "Commit e PR",
    order: 8,
    executors: [SESSION_EXECUTOR],
    agents: [],
    skills: ["commit", "conventional-commits"],
    gate: "Confirmação explícita",
    writes: ["08-commit-pr.md"],
  },
  {
    id: "deploy",
    label: "Deploy",
    order: 9,
    executors: ["devops-engineer"],
    agents: [executor("devops-engineer")],
    skills: ["release-operations", "github-actions-cicd", "docker", "observability"],
    gate: "Confirmação explícita",
    writes: ["09-deploy.md"],
  },
]);

module.exports = {
  DAI_AGENTS,
  BUILTIN_AGENTS,
  AGENT_LABELS,
  STAGES,
  SESSION_EXECUTOR,
};
