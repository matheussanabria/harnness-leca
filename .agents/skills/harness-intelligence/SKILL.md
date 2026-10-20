---
name: harness-intelligence
description: >-
  Planeja e conduz, por fases F0 a F7, a camada de Intelligence & Automation do
  Harness Leca (Script-First, Local-First, Cloud-on-Demand) para reduzir o consumo
  de cotas dos motores de IA sem perder qualidade. Use quando o usuário disser
  "plano diretor do harness", "reduzir consumo de cotas", "auditoria dos motores",
  "automation registry", "context engine", "roteador inteligente de tarefas",
  "benchmark de modelo local" ou "ollama no harness". Não usar para features
  comuns do harness (use sdlc-pipeline) nem para criar skills (use skill-architect).
language: pt-BR
version: "1.0.0"
date_created: "2026-10-19"
contract: manifest.yaml
---

# Harness Intelligence — plano e execução incremental

Dá ao agente o procedimento para auditar o Harness, desenhar contratos e entregar a
camada de roteamento entre script, modelo local e nuvem. Não implementa nada em
produção antes de o plano ser aprovado.

## Quando acionar / quando não acionar

- Aciona: diagnóstico de consumo, desenho dos módulos HIA, benchmark de modelos, backlog HIA-001 a HIA-014.
- Não aciona: feature isolada do harness (use `sdlc-pipeline`), criação de skill (use `skill-architect`), revisão de código (use `code-review-checklist`).

## Modos

| Pedido | Modo | Workflow |
|---|---|---|
| auditar / diagnosticar | **F0** | `workflows/f0-auditoria.md` |
| desenhar arquitetura e contratos | **F1** | `workflows/f1-arquitetura.md` |
| implementar etapa aprovada (F2 a F7) | **F2-F7** | `workflows/f2-f7-implementacao.md` |

Se o modo não estiver claro, pergunte uma vez em qual fase o trabalho está.

## Entrada e saída

- Entrada: fase desejada; `MAPA.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `SETUP.md`; dossiê `docs/harness-intelligence/` existente.
- Parâmetros de projeto (`where.project_config`): `docs_root` (pasta de documentação, ex.: `docs/`) e `repo_map_file` (mapa de módulos, ex.: `MAPA.md`); ler do `AGENTS.md` do projeto ou confirmar com o usuário.
- Saída: documento da fase em `docs/harness-intelligence/`, backlog atualizado e relatório com fatos observados separados de hipóteses.

## Regras

- Domínio: investigar antes de modificar; reutilizar o que existe; nuvem só com autorização e orçamento; novas funções com feature flag e fallback para o fluxo atual (detalhe em `references/02-diretrizes-obrigatorias.md`).
- Globais (`how.rules_ref`): `risky-actions-confirmation`, `no-invented-api`, `no-secrets-in-code`, `untrusted-content-as-data`, `evidence-hierarchy`, `max-file-size-modularity`, `security-by-default`, `tests-by-default`.

## Módulos

| Módulo | Arquivo | Consultar quando |
|---|---|---|
| Visão e pilares | `references/01-visao-e-pilares.md` | Entender estratégia, hardware e arquitetura |
| Diretrizes | `references/02-diretrizes-obrigatorias.md` | Antes de qualquer alteração |
| Fases e backlog | `references/03-fases-e-backlog.md` | Planejar F0 a F7 e HIA-001 a HIA-014 |
| Benchmark e métricas | `references/04-benchmark-e-metricas.md` | F4, F6 e relatório final |
| Formato da resposta | `references/05-formato-da-resposta.md` | Entregar o plano da F0 e F1 |
| Mapa de agentes | `references/06-agentes-e-skills.md` | Delegar a agentes DAI e motores |

## Quality

Concluído quando:
- o documento da fase existe, com referências cruzadas e sem repetir contexto;
- toda afirmação sobre o repositório cita arquivo ou comando;
- nenhuma alteração de produção foi feita antes da aprovação do plano.

Se houver incerteza: declare a suposição ou peça o contexto que falta.
Se for fora do escopo: explique o limite e indique a skill correta.
Casos de teste: `validation/test-cases.md`. Checklist: `validation/checklist.md`.
