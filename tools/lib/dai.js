// @ts-check
// Integração do Harness Leca com o DAI (Desenvolvimento Assistido com IA).
// Lê os agentes de .agents/ e skills/ de C:\Users\matheuss.rodrigues\git\DAI (ou DAI_PATH no .env).
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./env");

const DEFAULT_DAI_PATH = "C:\\Users\\matheuss.rodrigues\\git\\DAI";

function getDaiPath() {
  loadEnv();
  const custom = process.env.DAI_PATH;
  if (custom && fs.existsSync(custom)) return custom;
  if (fs.existsSync(DEFAULT_DAI_PATH)) return DEFAULT_DAI_PATH;
  return null;
}

/**
 * Lista todos os agentes especializados definidos no DAI (.agents/)
 * @returns {Array<{ id: string, name: string, icon: string, title: string, summary: string }>}
 */
function listDaiAgents() {
  const dai = getDaiPath();
  if (!dai) return [];
  const agentsDir = path.join(dai, ".agents");
  if (!fs.existsSync(agentsDir)) return [];

  const agents = [];
  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith("00-")) continue;
      const agentFile = path.join(agentsDir, ent.name, "AGENT.md");
      if (fs.existsSync(agentFile)) {
        try {
          const content = fs.readFileSync(agentFile, "utf8").replace(/^\uFEFF/, "");
          const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const first = lines[0] || "";
          // Exemplo: "# 🖥️ Frontend Engineer" ou "# Frontend Engineer"
          const match = first.match(/^#\s*([^\w\s]*)\s*(.*)$/);
          const icon = (match && match[1] ? match[1].trim() : "") || "🤖";
          const title = (match && match[2] ? match[2].trim() : ent.name) || ent.name;
          const summary = lines[1] && !lines[1].startsWith(">") && !lines[1].startsWith("#")
            ? lines[1]
            : (lines[2] || "");

          agents.push({
            id: ent.name,
            name: ent.name,
            icon,
            title,
            summary: summary.replace(/^>\s*/, "").slice(0, 120),
          });
        } catch {}
      }
    }
  } catch {}

  // Ordena com agentes principais de desenvolvimento e design no topo
  const priority = ["ux-ui-designer", "frontend-engineer", "software-developer", "refactor-clean-code", "qa-engineer", "software-architect", "backend-engineer"];
  return agents.sort((a, b) => {
    const idxA = priority.indexOf(a.id);
    const idxB = priority.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Lê o conteúdo do AGENT.md de um agente específico
 * @param {string} agentId
 * @returns {string|null}
 */
function getDaiAgentPrompt(agentId) {
  if (!agentId || !/^[a-z0-9_-]{1,64}$/i.test(agentId)) return null;
  const dai = getDaiPath();
  if (!dai) return null;
  const agentFile = path.join(dai, ".agents", agentId, "AGENT.md");
  if (!fs.existsSync(agentFile)) return null;
  try {
    return fs.readFileSync(agentFile, "utf8").replace(/^\uFEFF/, "").trim();
  } catch {
    return null;
  }
}

/**
 * Atalhos rápidos de workflows DAI para o Vibecoding Studio
 */
const DAI_WORKFLOWS = [
  {
    id: "design-system",
    label: "🎨 Design System",
    title: "Aplicar Design System",
    prompt: "Ajuste os componentes e a estilização desta tela/componente para utilizar estritamente os tokens, cores, espaçamentos e componentes do Design System do projeto.",
  },
  {
    id: "vibecoding-new",
    label: "✨ Nova Interface",
    title: "Construir Nova Interface",
    prompt: "Vamos criar uma nova interface moderna, responsiva e com excelente experiência de usuário para: ",
  },
  {
    id: "fix-layout",
    label: "⚡ Corrigir Visual",
    title: "Corrigir Glitch Visual / Alinhamento",
    prompt: "Analise a tela atual e corrija problemas de alinhamento, hierarquia visual, espaçamento ou contraste.",
  },
  {
    id: "clean-refactor",
    label: "🧹 Clean Code",
    title: "Refatorar Componente (Clean Code)",
    prompt: "Refatore este componente aplicando os princípios de Clean Code, extraindo subcomponentes se passar de 200 linhas e utilizando signals/computed adequadamente.",
  },
  {
    id: "bdd-gherkin",
    label: "🧪 BDD & Cenários",
    title: "Escrever BDD da Tela",
    prompt: "Escreva cenários BDD em Gherkin (Given/When/Then) cobrindo todos os fluxos principais e casos de borda desta tela.",
  },
];

module.exports = {
  getDaiPath,
  listDaiAgents,
  getDaiAgentPrompt,
  DAI_WORKFLOWS,
};
