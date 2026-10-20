# 06 - Agentes e skills por fase

Agentes DAI (em `dai/.agents/`) sao papeis executados dentro dos motores ativos: Gemini, Codex, Claude e OpenCode. Usar um orquestrador principal na F0 e F1; consultar os demais apenas para analises especializadas e nao redundantes, para nao multiplicar a leitura do repositorio e o consumo de cota.

| Fase | Agentes DAI | Motor sugerido | Skills DAI |
|---|---|---|---|
| F0 | software-architect, ai-engineer | Gemini | project-onboarding-scanner, technical-debt, refactoring |
| F1 | software-architect, sdd-agent, security-engineer | Gemini; revisao com Claude | software-architecture, data-modeling, agent-security |
| F2, F3 | backend-engineer, software-developer | Codex | feature-implementation, llm-application-engineering |
| F4 | ai-engineer, devops-engineer | OpenCode e Codex | llm-application-engineering, docker |
| F5 | ai-engineer, backend-engineer | Codex | software-architecture |
| F6 | backend-engineer, devops-engineer | Codex | backend-resilience, observability |
| F7 | frontend-engineer, ux-ui-designer, qa-engineer | Gemini | test-planning, release-operations |
| Todas | refactor-clean-code, documentation-engineer, qa-engineer | conforme a tarefa | code-review-checklist, test-planning |

Orquestracao das fases: `.agents/00-sdlc-orchestrator-prompt.md` do DAI. Coordenacao entre motores: `tools/coordination.js` do Harness (`claim`, `start`, `complete`, `handoff`, `notify`).
