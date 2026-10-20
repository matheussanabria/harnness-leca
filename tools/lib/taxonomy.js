// @ts-check
// Taxonomia de temas em árvore (pai → filhos) para classificar conversas. Uma conversa pode ter vários nós.
// `kw` são termos sem acento, comparados em minúsculas e sem acento; terminar com "*" casa por prefixo ("dispens*").
// `related` liga nós de pais diferentes que costumam aparecer juntos (ids "pai/filho"); serve de contexto, não de regra.

/** @typedef {{ id: string, name: string, kw: string[], related?: string[] }} TaxNode */
/** @typedef {{ id: string, name: string, color: string, children: TaxNode[] }} TaxParent */

/** @type {TaxParent[]} */
const TAXONOMY = [
  { id: "entrega", name: "Engenharia de entrega", color: "#94a3b8", children: [
    { id: "git", name: "Git & versionamento", kw: ["git", "commit*", "branch*", "rebase", "merge", "pull request", "pr", "cherry-pick", "stash", "worktree", "hotfix", "husky"], related: ["entrega/cicd"] },
    { id: "cicd", name: "CI/CD & pipelines", kw: ["ci/cd", "cicd", "pipeline*", "github actions", "workflow*", "jenkins", "release", "promocao", "build"], related: ["entrega/git", "seguranca/supply"] },
    { id: "infra", name: "Containers & infraestrutura", kw: ["docker*", "compose", "container*", "deploy*", "vps", "easypanel", "traefik", "kubernetes", "nginx", "infra*", "dockerfile"], related: ["backend/banco"] },
  ] },
  { id: "backend", name: "Backend", color: "#5c87f2", children: [
    { id: "api", name: "APIs & endpoints", kw: ["api", "endpoint*", "controller*", "rest", "dto", "spring*", "service", "swagger", "openapi", "webhook*"] },
    { id: "banco", name: "Banco de dados & migrations", kw: ["banco", "sql", "query", "postgres*", "oracle", "jpa", "hibernate", "migration*", "liquibase", "flyway", "schema*", "tabela*", "indice*", "dba", "script*"], related: ["entrega/infra"] },
    { id: "auth", name: "Autenticação & autorização", kw: ["keycloak", "oidc", "sso", "login", "autentic*", "autoriz*", "jwt", "token", "oauth*", "perfil", "permiss*", "rbac", "sessao"], related: ["seguranca/app"] },
  ] },
  { id: "seguranca", name: "Segurança", color: "#ef4444", children: [
    { id: "app", name: "Segurança da aplicação", kw: ["seguranca", "vulnerab*", "owasp", "xss", "csrf", "injecao", "injection", "cors", "criptograf*", "segredo*", "secret*", "lgpd", "privacidade", "redact*"], related: ["backend/auth"] },
    { id: "supply", name: "Cadeia de suprimentos & agentes", kw: ["supply chain", "dependabot", "npm audit", "prompt injection", "tool poisoning", "sandbox", "permissao do agente"], related: ["entrega/cicd", "ia/mcp"] },
  ] },
  { id: "frontend", name: "Frontend", color: "#06b6d4", children: [
    { id: "ds", name: "Design System & componentes", kw: ["design system", "componente*", "component*", "css", "token*", "tema*", "theme", "icone*", "icon*", "storybook", "tailwind", "angular", "react"] },
    { id: "telas", name: "Telas & fluxos de UX", kw: ["tela*", "layout", "modal", "dialog", "formulario*", "menu", "banner", "home", "pagina*", "ux", "ui", "responsiv*", "acessibilidade", "wcag"] },
  ] },
  { id: "qualidade", name: "Qualidade", color: "#10b981", children: [
    { id: "testes", name: "Testes", kw: ["teste*", "test", "unitario*", "mock*", "bdd", "cucumber", "gherkin", "tdd", "e2e", "cobertura", "junit", "vitest", "jest"] },
    { id: "lint", name: "Lint & análise estática", kw: ["eslint", "prettier", "linter", "lint", "checkstyle", "sonar*", "biome", "formatter", "tsc", "types"] },
    { id: "bugs", name: "Bugs & correções", kw: ["bug*", "erro*", "error", "falha*", "corrig*", "fix", "regressao", "excecao", "stacktrace", "crash"] },
  ] },
  { id: "ia", name: "IA & agentes", color: "#d97757", children: [
    { id: "mcp", name: "MCP & ferramentas", kw: ["mcp", "model context protocol", "tool*", "server.json", "stdio", "hook*", "plugin*"], related: ["seguranca/supply"] },
    { id: "prompt", name: "Prompts & skills", kw: ["prompt*", "skill*", "instrucao*", "instrucoes", "system prompt", "claude.md", "contexto", "token*", "memoria*"] },
    { id: "agentes", name: "Agentes (DAI)", kw: ["agente*", "dai", "orquestrador", "sdlc", "subagent*", "assistente", "devflow"] },
  ] },
  { id: "doc", name: "Documentação & arquitetura", color: "#ec4899", children: [
    { id: "docs", name: "Documentação & dossiês", kw: ["document*", "readme", "dossie*", "obsidian", "wiki", "adr", "runbook", "changelog", "story", "historia"] },
    { id: "arq", name: "Arquitetura & decisões", kw: ["arquitet*", "clean architecture", "solid", "diagrama*", "mermaid", "modelagem", "dominio", "decisao", "stack"] },
  ] },
  { id: "negocio", name: "Domínio de negócio", color: "#3cb371", children: [
    { id: "saude", name: "Saúde & dispensação", kw: ["dispens*", "medicament*", "posologia", "receita", "farmac*", "paciente*", "prontuario", "consulta", "exame*"] },
    { id: "financeiro", name: "Financeiro", kw: ["financ*", "fatur*", "pagamento*", "preco*", "precific*", "cobranca*", "boleto*", "cartao", "maquininha*", "nota fiscal", "conciliacao"] },
    { id: "veiculos", name: "Veículos & estoque", kw: ["veiculo*", "estoque", "carro*", "anuncio*", "multimarcas", "loja"] },
  ] },
];

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista plana de nós com id completo "pai/filho". */
function flatNodes() {
  return TAXONOMY.flatMap((p) => p.children.map((c) => ({ ...c, id: `${p.id}/${c.id}`, parent: p.id, parentName: p.name, color: p.color })));
}

module.exports = { TAXONOMY, flatNodes, norm };
