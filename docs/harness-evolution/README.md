# Evolução do Harness Leca — Fase 0

> O programa de implementação por épicos (EP-00 a EP-11) está no [índice mestre](00-index.md). Este README e os documentos `01` a `08` são o diagnóstico que serve de fonte para ele.

Este pacote registra o diagnóstico e o plano revisável solicitado em 2026-10-19. Nenhuma alteração funcional, migration ou configuração de produção faz parte desta entrega.

## Decisão recomendada

Evoluir a arquitetura existente de forma incremental. O repositório já contém módulos reutilizáveis para chat, Studio, Scrum, Mapa em Camadas, componentes, auditoria e orquestração; criar subsistemas paralelos aumentaria a divergência.

Primeira vertical após aprovação: chat principal, Studio e miniwidget compartilhando o mesmo contrato de apresentação e os mesmos comandos, com testes de menus, redimensionamento e preservação de conversa.

## Documentos

1. [Auditoria atual](01-current-state-audit.md)
2. [Requisitos e lacunas](02-requirements-and-gaps.md)
3. [Arquitetura-alvo](03-target-architecture.md)
4. [Chat, Studio e Design System](04-chat-studio-design-system.md)
5. [Domínios do produto](05-product-domains.md)
6. [Dados, segurança e testes](06-data-security-tests.md)
7. [Roadmap, riscos e aceite](07-roadmap-risks-acceptance.md)
8. [Backlog priorizado](08-prioritized-backlog.md)

## Checkpoint

Antes de implementar, confirmar: escopo da primeira vertical; compatibilidade de `scrum.json`; referências visuais do Mapa; e se Codex entra oficialmente no requisito multimotor, pois o código atual já o cataloga além dos três motores citados no plano.

