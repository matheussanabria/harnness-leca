# Harness Intelligence & Automation

Iniciativa para reduzir o consumo de cotas dos motores de IA sem perder qualidade. Estrategia: Script-First, Local-First, Cloud-on-Demand. Skill de conducao: `.agents/skills/harness-intelligence/SKILL.md` (sincronizada com `../dai/skills/orquestracao/harness-intelligence/`).

Regra transversal: nada pode quebrar os motores atuais; todo recurso novo tem feature flag e mantem o fluxo anterior como fallback.

## Documentos

| Arquivo | Fase | Estado |
|---|---|---|
| `01-current-state-audit.md` | F0 | Concluído (auditoria e linha de base preliminar) |
| `02-target-architecture.md` | F1 | Concluído (arquitetura alvo e componentes) |
| `03-technical-decisions.md` | F1 | Concluído (ADR-HIA-001 a 004) |
| `04-implementation-backlog.md` | F1 | Concluído (HIA-001 a HIA-014 detalhados) |
| `05-benchmark-plan.md` | F4 | Planejado para Fase F4 |
| `06-security-and-quality.md` | F1 | Concluído (diretrizes de segurança e qualidade) |
| `07-implementation-progress.md` | F2 a F7 | Não iniciado |
| `08-results-and-metrics.md` | F3 a F7 | Não iniciado |

Os arquivos sao criados quando a fase correspondente comeca, para nao manter documentos vazios. Cada documento referencia os demais em vez de repetir contexto.

## Relacao com outros dossies

- `docs/harness-evolution/`: evolucao do produto (UI, Scrum, Studio). Nao tratar consumo de IA ali.
- Backlog HIA-001 a HIA-014: descrito em `references/03-fases-e-backlog.md` da skill.
