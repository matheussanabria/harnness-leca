## 10. Inspeção, prévia e vínculos de artefatos

| Caminho | Responsabilidade |
|---|---|
| `ui/server/services/prototype-artifact-import.service.js` | Converte um artefato em cópia de inspeção, sem alterar a origem: HTML estático vira `screens/home.html`; `.dc.html` (com `<x-dc>`) vira partes em `dc/`. |
| `ui/server/services/dc-artifact-adapter.service.js` | Fachada do adaptador de `.dc.html` (Claude Design). Módulos: `dc-runtime-config`, `dc-artifact-parser` e `dc-inspection-writer`. |
| `ui/server/services/dc-runtime-config.service.js` | Hashes aceitos do runtime (`support.js` e SRI do React) e verificação dos arquivos em `ui/public/js/vendor/dc-runtime/`. Runtime alterado é recusado. |
| `ui/server/services/dc-artifact-parser.service.js` | Lê o `.dc.html` (template, helmet, lógica, `data-props`), valida (sem `import`/`require`, sem `</script`, sem `<script` no template, avisa recursos externos) e acha assets relativos. |
| `ui/server/services/dc-inspection-writer.service.js` | Grava `dc/template.html`, `logic.js`, `helmet.html`, `manifest.json` e `dc/assets/`. Idempotente pelo hash do original; bloqueio de validação sai com status 422. |
| `ui/server/services/prototype-sandbox-renderer.service.js` | Fachada do sandbox de protótipos. `metadata.runtime === "dc"` segue para o ramo DC; os demais seguem para `screens/<id>.html`. |
| `ui/server/services/prototype-sandbox-dc.service.js` | Renderiza protótipo DC com runtime local, CSP do sandbox, tela inicial via `startScreen.default` antes do boot, assets em data URI e `data-pid` estável por `data-dc-tpl`. |
| `ui/server/services/prototype-sandbox-common.service.js` | Estilos, ponte do harness e cabeçalhos CSP compartilhados pelos ramos estático e DC. |
| `ui/public/js/vendor/dc-runtime/` | React 18.3.1, ReactDOM 18.3.1 e `support.js` do Claude Design, byte a byte (SRI conferido). Servidos de `'self'` para a CSP do sandbox. |
| `ui/server/services/artifact-inventory-scan.service.js` | Varre as fontes de artefatos do projeto com validação de caminho, symlink e limite de leitura de título. |
| `ui/server/services/artifact-inventory.service.js` | Deduplica, mescla metadados, filtra acesso local, ordena, resume e limita o inventário de artefatos. |
| `ui/server/controllers/artifact.controller.js` | Rota `GET /api/project/:slug/artifacts` com validação de slug, projeto e filtro remoto. |
| `ui/server/controllers/artifact-import.controller.js` | Rota `POST /api/project/:slug/artifacts/import` para arquivos binários, com validação de projeto, nome e origem. |
| `ui/server/services/artifact-import.service.js` | Sanitiza nome/pasta, limita a 25 MB, grava sem sobrescrever, registra metadados e bloqueia symlink e travessia. |
| `ui/server/controllers/artifact-access.controller.js` | Rota `POST /api/project/:slug/artifacts/access` restrita a loopback. |
| `ui/server/controllers/artifact-preview.controller.js` | Rota `GET /api/project/:slug/artifacts/preview` com JSON e bytes sob sandbox. |
| `ui/server/controllers/artifact-relationships.controller.js` | Rotas `GET`/`POST /api/project/:slug/artifacts/relationships`; leitura remota filtra `local` e escrita exige loopback. |
| `ui/server/routes/artifact.routes.js` | Agrupa as rotas de artefatos usadas pelo roteador principal. |
| `ui/server/services/artifact-metadata.service.js` | Manifesto de origem/checksum/acesso, leitura tolerante e escrita atômica. |
| `ui/server/services/artifact-preview.service.js` | Resolve caminho, aplica acesso, limita tamanho e classifica a prévia. |
| `ui/server/services/artifact-relationships.service.js` | Chave estável de tela/campo, persistência atômica, destinos válidos e vínculos órfãos. |
| `ui/public/js/modules/design-artifacts-access.js` | Alternância de acesso na aba Artefatos. |
| `ui/public/js/modules/design-artifacts-preview.js` | Painel de prévia com HTML em sandbox, texto, imagem e PDF. |
| `ui/public/js/modules/design-artifacts-relationships.js` | Painel de vínculos, seletor de tela/campo, remoção e abertura no Mapa em Camadas. |
| `ui/public/js/modules/design-routines.js` | Aba Rotinas: catálogo, execução idempotente, fila de aprovações e histórico do projeto (EP-08.05). |
| `ui/public/js/modules/design-routines-api.js` | Cliente HTTP das rotinas, aprovações, decisão e histórico (EP-08.05). |
| `tests/artifact-inventory.test.js` | Cobre os sete tipos, estados, symlink, limite, controller e limites de arquivo. |
| `tests/artifact-import.test.js` | Cobre importação, colisão, segurança, controller, rota binária e limites de arquivo. |
| `tests/artifact-metadata.test.js` | Cobre manifesto, checksum, acesso local/projeto, filtro remoto, controller, rota e limites de arquivo. |
| `tests/artifact-preview.test.js` | Cobre texto, HTML, imagem, PDF, acesso remoto, manifesto inválido, controller, rota e limites. |
| `tests/artifact-relationships.test.js` | Cobre chave estável, add/remove, órfãos, filtro remoto, controller, rotas e limites. |
| `tests/capability-catalog.test.js` | Cobre catálogo versionado, estados, `resolveCapability`, campos legados, endpoints e limites (EP-08.01). |
| `tests/agent-stage-catalog.test.js` | Cobre etapas canônicas do SDLC, papéis dos agentes, consultas por etapa/agente, endpoints e limites (EP-08.02). |
| `tests/skill-bindings.test.js` | Cobre manifesto versionado, resolução, órfãos, limites, loopback, endpoints e limites de arquivo (EP-08.03). |
| `tests/workflow-runner.test.js` | Cobre catálogo de workflows, políticas, plano por projeto, ciclo de vida com eventos, falha, cancelamento e dryRun (EP-08.04). |
| `tests/workflow-http.test.js` | Cobre endpoints de workflows e execuções, loopback, erros, rotas registradas e limites de arquivo (EP-08.04). |
| `tests/routine-runner.test.js` | Cobre catálogo de rotinas, gatilhos, chave de idempotência, aprovação e rejeição de etapa sensível e histórico persistido (EP-08.05). |
| `tests/routine-http.test.js` | Cobre endpoints de rotinas, aprovações, decisão e histórico, com loopback, erros, rotas registradas e limites de arquivo (EP-08.05). |
| `tests/routine-ui.test.js` | Cobre a aba Rotinas da interface: aba registrada, despacho em `design.js`, folha de estilo, FontAwesome e ausência de emoji (EP-08.05). |
| `tests/deploy-pipeline.test.js` | Cobre o modelo de pipeline, o manifesto, a execução por estágios com resultado real, a confirmação, o mascaramento do webhook, os endpoints e a estrutura (EP-10.01). |
| `tests/deploy-status.test.js` | Cobre o resumo operacional, o estado desconhecido, o contrato da API, a paridade entre as duas superfícies e a estrutura (EP-10.05). |
| `tests/deploy-actions.test.js` | Cobre o catálogo de ações, a autorização com prazo e uso único, a confirmação, o dry run, a execução e a estrutura (EP-10.04). |
| `tests/deploy-timeline.test.js` | Cobre a linha do tempo unificada, os filtros, o histórico corrompido, os logs por execução e a estrutura (EP-10.03). |
| `tests/deploy-health.test.js` | Cobre o modelo de verificação, o manifesto, a verificação http e por comando, o agregado por ambiente, os endpoints e a estrutura (EP-10.02). |


## 11. Skills locais

| Caminho | Responsabilidade |
|---|---|
| `.agents/skills/preparar-chat-sincronizacao/` | Prepara uma conversa em prévia revisável de projeto, grupo, contexto, decisões e pendências antes da sincronização. |
| `.agents/skills/harness-intelligence/` | Skill DAI (contrato v2) que conduz as fases F0 a F7 da iniciativa Intelligence & Automation; espelho de `../dai/skills/orquestracao/harness-intelligence/`. |


## 12. Coordenação automática de agentes

| Caminho | Responsabilidade |
|---|---|
| `tools/coordination.js` | CLI de init, sync, status, claim, start, heartbeat, block, complete, handoff, notify e inbox. |
| `tools/lib/coordination/` | Configuração dos quatro provedores, importação do backlog, reducer, lock/persistência e projeções. |
| `projects/<slug>/coordination/state.json` | Ledger canônico versionado do projeto. |
| `projects/<slug>/coordination/events/*.jsonl` | Auditoria append-only separada pela origem do evento. |
| `projects/<slug>/coordination/inbox/*.md` | Caixas de entrada geradas para Claude, Gemini, OpenCode e Codex. |
| `projects/<slug>/context/coordination.md` | Resumo gerado carregável por qualquer agente no início da tarefa. |
| `docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md` | Decisão arquitetural e alternativas do protocolo. |
