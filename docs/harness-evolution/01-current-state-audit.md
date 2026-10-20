# Auditoria do estado atual

## Inventário

| Área | Implementação observada | Evidência |
|---|---|---|
| Runtime | Node.js >= 22.13, CommonJS no servidor e ES Modules nativos no navegador, sem dependências npm | `package.json`; `ui/server.js`; `ui/public/js/app.js` |
| HTTP | Servidor próprio, roteador declarativo e controllers por domínio | `ui/server/router.js`; `ui/server/controllers/` |
| Estado web | Objeto global; rascunho e conversa ativa por projeto em `localStorage` | `ui/public/js/shared/state.js` |
| Chat | Fachada modular sobre store, envio, SSE, render, persistência, anexos, permissões e miniwidget | `ui/public/js/modules/chat.js`; `chat-*.js`; `chat.controller.js` |
| Motores | Interface `{ id, stream, status }`; Claude, Gemini, OpenCode e Codex | `tools/lib/engines/index.js`; `catalog.json` |
| Studio | Fachada modular, iframe/companion, histórico compartilhado e sidebar redimensionável | `studio.js`; `studio-core.js`; `studio-companion.js` |
| Protótipos | Armazenamento, versões, sanitização, preview, edição e exportação | `ui/server/services/prototype-*.service.js` |
| Scrum | Histórias, épicos e Sprints em `projects/<slug>/scrum.json`; quatro status fixos | `project-scrum-*.js`; `scrum.controller.js` |
| Mapa | Serviços de camadas e UI modular de seis abas | `design-layers.service.js`; `modules/design-layers/` |
| Componentes | Descoberta, seis marcos e envio de contexto ao chat | `design-index.service.js`; `design-stage.service.js`; `design-board.js` |
| Auditoria | Métricas derivadas de regras, testes, legado e componentes | `project-audit.service.js`; `design-audit-*.js` |
| Agentes | Contrato de eventos, projeção, deduplicação e adaptadores | `services/orchestration/`; `tests/orchestration.test.js` |
| Testes | `node:test`; servidor, motores, permissões, design e protótipos | `tests/*.test.js` |

## Fluxos

1. `boot.js` carrega parciais antes de `app.js`.
2. O chat envia motor, contexto, histórico e configurações a `POST /api/chat`.
3. O controller seleciona o motor e devolve SSE; a UI atualiza `state.chatTurns`.
4. A conversa fica localmente e é salva como Markdown por `/api/chat/save`.
5. Studio alterna apresentação, mas chama o mesmo histórico e envio.
6. Scrum lê/inicializa `scrum.json`, sanitiza e grava o documento completo.

## Restrições

- Há trabalho não commitado anterior em grande parte do repositório; esta auditoria não o altera.
- Exceções autorais ao teto de 300 linhas: `studio.html` (411), `prototype-atelier.js` (380), `03-barra-camadas.css` (1437) e `04-mini-chat-dock.css` (304). `OrbitControls.js` é vendor.
- As capturas comparativas citadas não foram fornecidas; fidelidade visual e regressão por imagem não são verificáveis.
- Não há ferramenta de cobertura no `package.json`; existência de testes não demonstra percentual de cobertura.

