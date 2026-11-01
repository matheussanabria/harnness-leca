# Harness Leca — Contexto: Scrum Automation & Development Traceability

> Estado: proposta para revisão técnica. Não representa implementação confirmada.
> Data: 2026-10-31
> Escopo: integração do Scrum/Kanban existente com execuções de agentes, Git, artefatos e auditoria.

## 1. Motivação

Toda nova implementação iniciada no Harness deve possuir uma história no Scrum ou uma pendência explícita de vinculação. O objetivo é permitir reconstruir **por que** uma alteração foi solicitada, **quem/o que** a executou, **quais arquivos** foram afetados, **quais evidências** foram produzidas e **quem** validou o resultado.

O Scrum é a visão de gestão do trabalho; a trilha de auditoria é o registro dos acontecimentos. Não devem ser confundidos.

## 2. Contexto funcional conhecido por conversas anteriores

Estes itens são contexto informado/discutido anteriormente e **precisam ser conferidos no repositório** antes da implementação:

- Já existe funcionalidade Scrum/Kanban com 12 raias: Impedimento, Especificação, Prototipação, Modelagem, Pronto p/ Dev, Em Dev, Em revisão, Em testes, Testado, Em homologação, Homologado, Concluído.
- Foi discutido controle de concorrência por `lanesRevision` e histórico de transições.
- A coordenação de agentes envolve mecanismos como `state.json`, eventos JSONL e uma decisão arquitetural referida como ADR-007.
- Há múltiplos motores e sessões: Claude, Codex, Gemini e OpenCode, entre outros.
- O `MAPA.md` é usado/planejado como índice arquitetural de arquivos e contexto compartilhável.
- Existem iniciativas correlatas de Harness Memory, telemetria de agentes, skills/workflows e integração com Jira.

**Não pressupor nomes de tabelas, APIs, caminhos, schemas ou hooks sem inspeção.**

## 3. Objetivos

1. Criar ou vincular automaticamente histórias quando uma implementação for iniciada.
2. Evitar duplicatas; apresentar candidatos quando a correspondência não for segura.
3. Associar história a uma ou mais implementações e cada implementação a várias execuções/sessões/agentes.
4. Capturar evidências observáveis de alteração de código, commits, testes e revisões.
5. Construir uma linha do tempo auditável, com autoria, origem, correlação e timestamps.
6. Respeitar regras de permissão, matriz de transições, aprovação e concorrência existentes.
7. Compartilhar contexto resumido entre motores sem depender de um único provedor de LLM.
8. Permitir reconciliação de eventos perdidos, repetidos ou sem vínculo.

## 4. Não objetivos iniciais

- Substituir o Scrum existente.
- Automatizar todas as movimentações de raia na primeira entrega.
- Declarar sucesso de teste ou conclusão com base somente no texto emitido por um agente.
- Espelhar integralmente Jira ou permitir escrita externa sem autorização.
- Tornar um banco vetorial fonte de verdade de auditoria.

## 5. Entidades conceituais (propostas)

- **Story:** unidade gerencial; critérios de aceite, responsável, raia e histórico.
- **Implementation:** mudança ou objetivo técnico vinculado a uma história.
- **Execution:** tentativa ou sessão concreta de um agente/processo na implementação.
- **Evidence:** commit, diff, resultado de teste, revisão, documento ou artefato comprovável.
- **AuditEvent:** fato append-only com identificador e origem.
- **Correlation:** vínculo transversal entre chat, história, implementação, execução e artefatos.

Cardinalidade-alvo: Story 1:N Implementation; Implementation 1:N Execution; Implementation 1:N Evidence; cada entidade pode originar múltiplos AuditEvents. O vínculo entre execuções e evidências deve ser verificado no desenho concreto.

## 6. Eventos conceituais

```ts
type DevelopmentEvent = {
  id: string;
  schemaVersion: 1;
  correlationId: string;
  storyId: string | null;
  implementationId: string;
  executionId?: string;
  occurredAt: string;
  source: "agent" | "git" | "scrum" | "system";
  type:
    | "implementation.started"
    | "file.changed"
    | "test.completed"
    | "commit.created"
    | "implementation.completed"
    | "review.approved";
  actor: {
    kind: "human" | "agent" | "system";
    id: string;
    engine?: string;
  };
  payload: Record<string, unknown>;
};
```

Contrato **ilustrativo**: revisar campos, versões, IDs, nomenclatura e extensão dos eventos à luz do código. Atestar sucesso somente com fontes confiáveis (ex.: resultado do runner, SHA Git, aprovação identificada).

## 7. Fluxo desejado

1. Usuário ou agente inicia demanda em chat, Ateliê, workflow ou terminal.
2. Um detector identifica a **intenção de implementação**; não confunde análise, leitura ou comandos exploratórios com mudança.
3. O Story Resolver busca história compatível no projeto/escopo correto.
4. Se correspondência for inequívoca, vincula; caso contrário, solicita decisão ou cria pendência. Criação automática é permitida por política explícita.
5. Gera `implementationId` e `correlationId`; vincula sessões e motores subsequentes.
6. Coletores capturam alterações, commits, testes e aprovações em eventos idempotentes.
7. Uma projeção consultável atualiza a visão da história e as evidências.
8. O Scrum sugere/realiza apenas transições autorizadas e verificadas.
9. O usuário consulta timeline, evidências, responsáveis, custos e decisões.

## 8. Política inicial de automação

**Recomendação: híbrida.** Vinculação, criação configurável e captura de evidências são automáticas; revisão, homologação, exclusão e conclusão exigem gates/autorizações adequadas. Nunca alterar silenciosamente a raia se a máquina de estados impedir a transição.

Uma implementação órfã vira **pendência de vinculação**, sem bloquear automaticamente o trabalho. A equipe poderá elevar a exigência a Quality Gate depois de validar a cobertura dos coletores.

## 9. Persistência e auditoria

- Preferir adaptar a persistência existente em vez de criar uma segunda fonte de verdade.
- Considerar eventos append-only e projeção consultável (por exemplo SQLite) somente após inspeção da arquitetura atual.
- Exigir idempotência de ingestão, versão de schema, referências verificáveis, ordenação lógica e recuperação/replay.
- Não registrar segredos, payloads sensíveis completos, tokens, variáveis de ambiente ou conteúdo de prompts privados sem autorização explícita.
- Definir retenção, redaction, permissões por projeto e trilha de acessos.
- O `MAPA.md` é um índice derivado/arquitetural, não o repositório autoritativo de eventos.

## 10. Integrações e decisões pendentes

| Área | Hipótese / decisão proposta | Validação necessária |
|---|---|---|
| Scrum | Reusar serviços e transições atuais | Encontrar implementação concreta |
| Orquestração | Instrumentar adaptadores por motor | Mapear hooks/eventos disponíveis |
| Git | Usar SHA, branch e trailers de commit | Detectar commits fora do Harness e rebase |
| Testes | Registrar comando, exit code e relatórios | Verificar runners e integridade dos resultados |
| MAPA.md | Referenciar arquivos e decisões | Auditar geração e regras existentes |
| Memory | Expor resumos e checkpoints controlados | Revisar permissão, isolamento e sincronização |
| Jira | Integração opcional, posteriormente | Mapear permissões e conflitos de fonte de verdade |
| Telemetria | Agregar custo/tempo por implementação | Confirmar métricas realmente disponíveis |

## 11. Condições de qualidade

- Não criar duas histórias para o mesmo evento reprocessado.
- Não associar evidência ao projeto errado.
- Não transformar alegação de agente em prova de teste aprovado.
- Não perder a trilha em reinício, concorrência ou falha parcial.
- Não impedir execução legítima quando integração estiver indisponível, salvo política explícita.
- Manter auditabilidade também para reversões e reaberturas.

## 12. Exemplo ilustrativo

Demanda: “Corrigir botões do Ateliê que levam a 404”.

- Resolver encontra ou cria história sob o projeto correto.
- Uma implementação reúne múltiplas execuções de agentes.
- Diferenças de arquivos e commits são anexados como evidências verificáveis.
- Resultados de testes de navegação são capturados pelo runner.
- A história só avança para conclusão segundo critérios de aceite e política definida.

**Observação:** IDs como `SCRUM-142`/`IMP-2026-0142` são apenas exemplos, não registros existentes.


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
