---
id: EP-09
titulo: Central de sessões, observabilidade e orquestração
prioridade: P1
status: especificado
depende: [EP-01, EP-02, EP-03, EP-04, EP-08]
tags: [harness-evolution, epico, sessoes, orquestracao]
---

# EP-09: Central de sessões, observabilidade e orquestração

[Voltar ao índice](../../00-index.md)

## Objetivo

Consolidar conversas, sessões nativas, execuções, workflows e pedidos de intervenção dos motores integrados em uma central independente de provedor, acessível pela interface principal e pelo Escritório 3D.

## Limites de responsabilidade

- EP-02 continua proprietário do núcleo de chat, apresentações e continuidade de conversa.
- EP-03 continua proprietário das interações e projeções do Escritório 2.5D/3D.
- EP-08 continua proprietário da execução de workflows e das políticas de aprovação.
- EP-09 mantém o registro canônico, as projeções operacionais, a Central e seus consumidores.
- O Scrum existente não será usado como fonte dos estados de sessão; apenas componentes visuais poderão ser reutilizados.

## Entrega

Uma Central capaz de descobrir e pesquisar sessões, distinguir estado do motor de estado do workflow, navegar ou retomar uma conversa quando suportado, projetar itens em lista e Kanban, destacar bloqueios e reunir aprovações pendentes.

## Aceite do épico

Nenhuma ação ou estado é apresentado como disponível ou concluído sem capacidade e evidência verificáveis. Reiniciar o servidor não perde o registro canônico nem os eventos já persistidos.

## Pacote arquitetural da primeira etapa

| Entregável | Documento |
|---|---|
| Diagnóstico da arquitetura atual | [00-diagnostico-arquitetura.md](00-diagnostico-arquitetura.md) |
| Inventário de componentes reutilizáveis | [01-inventario-reuso.md](01-inventario-reuso.md) |
| Matriz de capacidades por motor | [02-matriz-capacidades.md](02-matriz-capacidades.md) |
| Modelo canônico de sessão | [03-modelo-canonico-sessao.md](03-modelo-canonico-sessao.md) |
| Máquina de estados do workflow | [04-maquina-estados-workflow.md](04-maquina-estados-workflow.md) |
| Eventos e notificações | [05-eventos-notificacoes.md](05-eventos-notificacoes.md) |
| UI da Central e Kanban | [06-ui-central-kanban.md](06-ui-central-kanban.md) |
| Integração com Escritório, Chat e Window Manager | [07-integracao-escritorio.md](07-integracao-escritorio.md) |
| Roadmap incremental | [08-roadmap.md](08-roadmap.md) |
| Critérios de aceite e testes | [TP-09](../../04-test-plans/TP-09-central-sessoes.md) |
| Notas do hardening pós-aprovação | [05-dev-notas.md](05-dev-notas.md) |

## Incremento pós-aprovação

O baseline técnico anterior à história 09.01 foi estabilizado: sync idempotente entre motores e entre fontes Claude duplicadas, além de encerramento confiável da árvore de processos. O registro canônico (09.01) e a Central em lista e Kanban (09.03) estão implementados; a 09.02 (event log e SSE) está em andamento em outra frente, com o contrato de leitura já congelado.

## Decisões propostas

- [ADR-004](../../03-decisions/ADR-004-registro-canonico-sessoes.md): registro canônico desacoplado dos motores.
- [ADR-005](../../03-decisions/ADR-005-eventos-persistentes-sqlite.md): log persistente local com SQLite nativo.
- [ADR-006](../../03-decisions/ADR-006-estados-ortogonais.md): estados de execução, workflow e atenção separados.

## Histórias

Os títulos abaixo substituem os títulos provisórios sem alterar a quantidade do backlog.

| ID | Título | Dependências principais |
|---|---|---|
| [09.01](./09.01-descoberta-registro-canonico.md) | Descoberta e registro canônico de sessões | 02.02, 04.01, 08.05 |
| 09.02 | Event log persistente, projeções e recuperação SSE | 09.01 |
| [09.03](./09.03-central-lista-kanban.md) | Central pesquisável em lista e Kanban | 09.01, 09.02 |
| 09.04 | Navegação, retomada e integração com Chat/Escritório | 02.06, 03.03, 09.03 |
| 09.05 | Atenção necessária, notificações e fila de aprovações | 08.05, 09.02 |


## Fora do escopo da primeira etapa

- implementar serviços, rotas, persistência ou UI;
- inventar retomada, cancelamento ou aprovação que o motor não ofereça;
- controlar processos externos iniciados fora do Harness;
- substituir o formato Markdown ou apagar históricos existentes;
- alterar o Design System ou o Window Manager.
