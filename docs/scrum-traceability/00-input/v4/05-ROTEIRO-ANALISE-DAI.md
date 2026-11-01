> **Fonte prioritária:** DAI no caminho local informado em `01-CONFIGURACAO-REPOSITORIOS.md`; preservar branch e working tree.

# DAI — Roteiro de identificação e comparação com Harness Leca

> Status: **repositório DAI não identificado com segurança**.
> Em consulta GitHub efetuada em 2026-10-31: a busca por `DAI user:matheussanabria` não retornou repositórios; `matheussanabria/harnness-leca` foi localizado. Busca global por `DAI` retorna projetos de terceiros não necessariamente relacionados. **Não considerar esses repositórios como DAI do usuário.**

## Identificação necessária

- URL exata (`https://github.com/OWNER/DAI`) ou owner/organização.
- Branch/tag/commit a comparar.
- Nível de acesso caso privado; não presumir acesso ao repositório.
- Objetivo da comparação: integração, inspiração de arquitetura, migração ou reutilização de código.

## Protocolo de inspeção (somente leitura)

1. Validar identidade e descrição do DAI, README, estrutura de pastas e estado recente.
2. Mapear tecnologias, persistência, UI e fluxos de produto.
3. Investigar agentes, especialistas, papéis, roteadores, workflows, skills, MCP e permissões.
4. Investigar eventos, telemetria, memória, documentação, quality gates e auditoria.
5. Buscar módulos de backlog, sprint, gestão de demandas e rastreio de implementações.
6. Conferir licenças, dependências e compatibilidade de integração; não copiar código sem avaliar direitos e riscos.
7. Referenciar evidências com caminhos e, quando possível, commit e linhas.

## Matriz comparativa a preencher

| Capacidade | Harness (evidência) | DAI (evidência) | Lacuna | Decisão sugerida |
|---|---|---|---|---|
| Backlog, rascunhos e sprints | Pendente | Pendente | — | — |
| Refinamento RF/RNF/BDD | Pendente | Pendente | — | — |
| Especialistas por etapa | Pendente | Pendente | — | — |
| Orquestrador de workflows | Pendente | Pendente | — | — |
| Quality Gates | Pendente | Pendente | — | — |
| Hooks, agentes e sessões | Pendente | Pendente | — | — |
| Git, testes e rastreabilidade | Pendente | Pendente | — | — |
| Persistência e eventos | Pendente | Pendente | — | — |
| Memória compartilhada | Pendente | Pendente | — | — |
| Autorização e segurança | Pendente | Pendente | — | — |

## Resultado esperado

Análise de *reuse / adapt / build* para cada capacidade com riscos, esforço relativo, integração incremental, incompatibilidades e recomendação. **Não associar DAI a nenhum outro projeto só pela semelhança do nome.**


---

## Adendo v3 — integração DAI (31/10/2026)

**Status:** evidências documentais consultadas na branch padrão `dev` de `matheussanabria/harness-dai`; comportamento de runtime ainda NÃO auditado. Este adendo prevalece sobre propostas anteriores que pressupunham inexistência de pipelines e especialistas.

- Fonte: `README.md`: `.agents/` é origem dos 17 agentes; `skills/` é origem das competências; exportação para Claude Code via `scripts/export_claude_code.py`; `harness/cli.py` é caminho legado.
- Fonte: `skills/orquestracao/sdlc-pipeline/SKILL.md`: skill executa o workflow `feature-delivery`, com execução por estágio, dossiê `docs/features/<slug>/`, `_status.md`, gates e variantes `domain-creation`, `domain-change`, `composition`, `hotfix`.
- Fonte: `docs/SDLC_PIPELINE_DESIGN.md`: estágios `story`, `bdd`, `prototype`, `modeling`, `dev`, `tests`, `review`, `commit-pr`, `deploy`; mapeamento de especialistas; confirmação explícita para commit/PR e deploy.
- Fonte: `workflows/product-delivery/WORKFLOW.md`: macrofluxo de produto com estados discovery → requirements → design → architecture → engineering → features → quality → deploy; documento marcado `draft` e informa ausência de adaptador ponta a ponta.

**Implicações para Scrum:**
1. Não criar um segundo pipeline SDLC concorrente: avaliar adaptador para contratos e artefatos existentes no DAI.
2. Separar `demand maturity`, `sprint allocation`, `workflow stage` e `execution status` (dimensões diferentes, sem forçar novas raias).
3. Refinamento preferencialmente antes da seleção para sprint; permitir exceções com autorização e registro.
4. Usar `storyId` e `workflowRunId` como vínculo, sem tratar `_status.md` como única fonte transacional de auditoria.
5. Os dados de Scrum, histórico e `lanesRevision` existentes devem ser preservados; investigar modelos reais antes de desenhar migrações.
6. Garantir operação multi-motor através de adaptadores; a skill documentada é Claude Code-first.
7. Verificar a localização efetiva de `workflows/feature-delivery/manifest.yaml` e a cópia exportada antes de assumir resolução de caminhos.

**Decisão pendente:** autorizar somente Discovery e plano técnico nesta rodada; não editar repositórios, não mover histórias e não executar workflows, commits ou deploy.

Leia também `06-INTEGRACAO-SCRUM-DAI.md` e `07-PROMPT-REVISAO-CRUZADA.md` nesta pasta.
