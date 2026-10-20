# Backlog priorizado

IDs provisórios; complexidade S/M/L/XL. Cada item resume problema/objetivo, escopo, dependência, aceite, teste e risco.

## P0

- **HAR-001 — Auditoria (M):** criar baseline comprovável. Sem dependência. Aceite: matriz com evidência/validação. Testes: links/gates. Risco: código mudar.
- **HAR-002 — Contratos e foundations (L):** schemas, comandos, tokens e camadas. Depende 001. Aceite: versão + adapters cobertos. Testes: unidade/contrato. Risco: abstração prematura.
- **HAR-003 — Chat core/UI (XL):** remover divergência por layout. Depende 002. Aceite: paridade de SSE, erros, anexos e histórico. Testes: integração. Risco: sessão.
- **HAR-004 — Menus/popovers (M):** primitive acessível. Depende 003. Aceite: foco, Escape, clique externo/mobile. Testes: DOM. Risco: dialogs.
- **HAR-005 — Miniwidget (L):** adapter floating/minimized. Depende 003/004. Aceite: mesma sessão, sem mistura. Testes: duas instâncias. Risco: streams.
- **HAR-006 — Studio resize (L):** mouse/toque/teclado e preview estável. Depende 003. Testes: E2E/visual. Risco: iframe.

## P1

- **HAR-007 — Capabilities do composer (M):** anexos, skills e ações iguais. Depende 003. Aceite por layout. Risco: contexto excessivo.
- **HAR-008 — Raias/migração (XL):** 12 lanes, transições, blockers, versão. Depende 002. Aceite: compatibilidade/idempotência/rollback. Risco: mapeamento.
- **HAR-009 — Ordem/persistência (L):** editar, ocultar, desativar e concorrência. Depende 008. Aceite: ordem por projeto. Risco: sobrescrita.
- **HAR-010 — Transições/impedimentos (L):** backend e histórico. Depende 008. Aceite: origem preservada. Testes: matriz. Risco: regra incompleta.
- **HAR-011 — Backlog/filtros/métricas (L):** fonte única. Depende 009/010. Aceite: sem divergência. Risco: performance.
- **HAR-012 — Fidelidade do Mapa (L):** reproduzir capturas. Depende referências/002. Aceite visual. Risco: fontes ausentes.
- **HAR-013 — Rastreabilidade (L):** chave e navegação ponta a ponta. Depende 002. Aceite: seleção/links. Risco: dados incompletos.
- **HAR-018 — Testes/visual (L):** harness e baselines. Depende 002 e evolui transversalmente. Risco: fragilidade.
- **HAR-019 — Segurança/a11y (L):** threat model, auth, XSS, uploads, foco/ARIA. Transversal. Aceite: testes negativos. Risco: falsa segurança.

## P2

- **HAR-014 — Componentes (L):** marcos independentes, referências e histórico. Depende 002/013. Aceite: multi-marco e contexto por ID. Risco: dedução.
- **HAR-015 — Auditoria (L):** evidências e quatro estados de teste. Depende 013. Aceite: gerado não é aprovado. Risco: retrocompatibilidade.
- **HAR-016 — Agentes/skills (XL):** política por projeto/raia. Depende 008/event engine. Aceite: contexto mínimo/permissões. Risco: privilégio.
- **HAR-017 — Gatilhos/aprovações (XL):** execução idempotente/auditável. Depende 016. Aceite: sem duplicidade e aprovação sensível. Risco: automação destrutiva.

