// @ts-check
// Areas for grouping skills and agents, and the keyword classifier that suggests one.

/** @type {Array<{ id: string, label: string, icon: string, keywords: string[] }>} */
const AREAS = [
  { id: "documentation", label: "Documentação", icon: "fa-book", keywords: ["documentation", "documentacao", "readme", "adr", "changelog", "runbook", "technical-writing", "documenter", "obsidian", "release-communication"] },
  { id: "frontend", label: "Frontend", icon: "fa-display", keywords: ["frontend", "angular", "react", "nextjs", "css", "componente", "ui", "ux", "acessibilidade", "accessibility", "design"] },
  { id: "backend", label: "Backend", icon: "fa-server", keywords: ["backend", "java", "spring", "checkstyle", "api", "rest", "data-modeling", "sql", "resilience", "banco"] },
  { id: "quality", label: "Qualidade e testes", icon: "fa-vial", keywords: ["test", "teste", "qa", "bdd", "bug", "tdd", "lint", "quality", "review", "clean-code", "refactor"] },
  { id: "security", label: "Segurança", icon: "fa-shield-halved", keywords: ["security", "seguranca", "owasp", "threat", "supply-chain", "secret"] },
  { id: "devops", label: "DevOps", icon: "fa-gears", keywords: ["devops", "docker", "ci", "cd", "deploy", "pipeline", "github-actions", "observability", "release-operations", "commit"] },
  { id: "product", label: "Produto e processo", icon: "fa-clipboard-list", keywords: ["product", "produto", "backlog", "scrum", "agile", "sprint", "requirements", "story", "jira", "discovery", "okr"] },
  { id: "architecture", label: "Arquitetura", icon: "fa-sitemap", keywords: ["architect", "arquitetura", "architecture", "solid", "sdd", "design-document", "technical-debt", "breakdown", "evolution"] },
  { id: "ai", label: "IA e automação", icon: "fa-robot", keywords: ["llm", "ai", "agent", "prompt", "mcp", "orchestr", "coordination", "alethe", "harness", "skill", "postman"] },
];

const OTHER = { id: "other", label: "Outros", icon: "fa-folder-open" };

/**
 * Suggests an area id from the item name (weight 3) and description (weight 1).
 * Short keywords (3 chars or fewer) must match a whole word; longer ones match as substrings.
 * @param {string} name
 * @param {string} description
 * @returns {string}
 */
function classify(name, description) {
  const nameText = String(name || "").toLowerCase();
  const descText = String(description || "").toLowerCase();
  const hit = (text, kw) => {
    if (kw.length > 3) return text.includes(kw);
    return new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`).test(text);
  };
  let best = OTHER.id;
  let bestScore = 0;
  for (const area of AREAS) {
    let score = 0;
    for (const kw of area.keywords) {
      if (hit(nameText, kw)) score += 3;
      if (hit(descText, kw)) score += 1;
    }
    if (score > bestScore) {
      best = area.id;
      bestScore = score;
    }
  }
  return best;
}

/** @returns {Array<{ id: string, label: string, icon: string }>} */
function listAreas() {
  return [...AREAS.map(({ id, label, icon }) => ({ id, label, icon })), OTHER];
}

/** @param {string} id */
function isAreaId(id) {
  return listAreas().some((a) => a.id === id);
}

module.exports = { AREAS, OTHER, classify, listAreas, isAreaId };
