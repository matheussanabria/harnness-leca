# Harness architecture

How the harness works end to end: how the chat gets its context on each screen, where each project's configuration
lives, how a feature is delivered, and how the delivery is validated. Each page describes what exists today, with file
references, then the gaps and a proposal. Snapshot: 2026-11-13. Portuguese version: [pt-BR/README.md](pt-BR/README.md).

| Page | Answers |
|---|---|
| [01-chat-context-by-surface.md](01-chat-context-by-surface.md) | What context the chat loads on the home screen, Ateliê, mind map and diagrams. Whether it recognises and keeps the current artifact. How conversations are restored |
| [02-project-config-hybrid.md](02-project-config-hybrid.md) | Whether a project's harness configuration lives in the harness or in the project repo, and a standard that supports both |
| [03-delivery-pipeline.md](03-delivery-pipeline.md) | Prototype with the Design System, then story, BDD, tests, code and deploy. The agents at each stage, the traceable deliverables, the documentation and how the layers map is built |
| [04-validation-and-gates.md](04-validation-and-gates.md) | Traceability gates, the proposed mind-map validation, prototype vs code (G10-G13, Chrome) and the technical checks (linters, sensors, map) |

## Main gaps

| Id | Gap | Page |
|---|---|---|
| G-CTX-1 | No shared context provider for chat surfaces; each surface wires its own | 01 |
| G-CTX-2 | The Ateliê agent does not receive the project design profile, DS index or MCP rule | 01 |
| G-CTX-4 | Saved chats lose their surface and artifact, so resuming does not reopen the prototype or board | 01 |
| G-CTX-7 | No bootstrap of the initial artifact when a surface has none | 01 |
| G-CFG-1 | Seven separate repo resolvers and hardcoded DIS paths; no single project resolver | 02 |
| G-CFG-2 | The gate config is duplicated in the harness and the repo | 02 |
| G-VAL-1 | No mind-map view of the feature's traceability chain | 04 |
| G-VAL-2 | G13 covers one screen with a manual login, and takes no screenshots | 04 |
| G-VAL-3 | The Checkstyle audit item is a hardcoded `PASS` | 04 |
| G-DEL-1 | Nothing checks that implementation used the DS MCP | 03 |
| G-DEL-2 | The playbook and the workflow disagree on prototype vs modeling order | 03 |

Related, more detailed documents:
- [delivery/rota-curta.md](../delivery/rota-curta.md)
- [rastreio-gate/02-diagramas.md](../rastreio-gate/02-diagramas.md)
- [harness-gates/](../harness-gates/)
- [scrum-traceability/](../scrum-traceability/)
- [harness-evolution/03-decisions/](../harness-evolution/03-decisions/), especially ADR-016.
