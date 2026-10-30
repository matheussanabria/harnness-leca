## ⚡ 4. Motores de IA e Extratores (`tools/lib/`)

- [`tools/lib/engines/index.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/index.js): Registro unificado dos motores (`claude`, `gemini`, `opencode`). Todos seguem a interface `{ id, stream, status }`.
- `tools/lib/engines/opencode-model.js`: Converts a model id (`provider/model`, e.g. `9router/Harness`; no prefix = built-in `opencode` provider) into the `{providerID, modelID}` reference.
- `tools/lib/opencode-v2.js`: Client for the opencode v2 HTTP API (`/api/*`, Basic auth): create session (model set at creation), prompt, per-turn message summary (reasoning/text/idle outcome and error), interrupt, model list.
- `tools/lib/opencode-v2-turn.js`: One streaming turn on the opencode v2 API: subscribes to `/api/event` (reasoning/text deltas), sends the prompt, falls back to reading `/message`, treats "session still active" as alive (idle timeout only when the server session stopped), abort sends interrupt.
- `ui/server/services/atelier-proto-context.service.js`: Reads the prototype state from disk on every agent run (screens, proto.css, storage keys, unregistered screens) and builds the block prepended to the model prompt so stage 2 continues stage 1 instead of reinventing the Design System.
- `tests/atelier-proto-context.test.js`: Context block contents, empty prototype, and loop delivery (model gets context, event shows only the request).
- `ui/server/services/atelier-tool-tags.service.js`: Parses the `<tool name=...>` tags models write in text: raw HTML/CSS body for `atelier_write_screen`/`atelier_patch_styles` (no JSON), JSON with raw newlines repaired, unreadable tags returned as errors instead of being dropped.
- `tests/atelier-tool-tags.test.js`: Tag parser (JSON, repaired JSON, raw HTML/CSS, explicit errors) and the `cssRules`/`cssContent` + `atelier_parse_error` tools.
- `tools/start-opencode.js`: `npm run opencode`; starts `opencode serve --port 63186` with the shared OPENCODE_SERVER_PASSWORD from `global/.env` (generated on first use).
- `tools/lib/engine-autostart.js`: On UI boot, starts 9router (:20128) and opencode (:63186) in the background if they are not answering (any HTTP response counts as up), runs the real executables (no console window) and keeps the opencode password stable in `global/.env`; HARNESS_AUTOSTART=0 disables it, OPENCODE_BIN overrides the binary. Never throws.
- `tests/opencode-v2-turn.test.js`: Streaming turn against a fake SSE server (deltas, failure, silence with active/stopped session, SSE down, abort).
- `tests/opencode-v2.test.js`: v2 client against a fake HTTP server with password (routes, bodies, turn summary, model list, API errors).
- `tests/engine-autostart.test.js`: Autostart with a fake HTTP server (already-up, disabled, missing binary) and the "OpenCode desligado" error message for `fetch failed`.
- [`tools/lib/engines/codex.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/codex.js): Integra o CLI local do Codex, com retomada de sessão, modelo e intensidade de raciocínio.
- `tools/lib/claude-sync-sources.js`: Reconcilia sessões Claude duplicadas entre workspaces e escolhe uma fonte determinística antes do sync.
- [`tools/lib/dai.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/dai.js): Integração com o esquadrão DAI (17 agentes especialistas) e workflows.
- [`tools/lib/network.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/network.js): Descoberta de IPs locais, geração de QR Code ASCII/SVG e proxies WebSocket.
- [`tools/lib/proc-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/proc-manager.js): Orquestrador de processos em background por projeto.
- `tools/lib/export/managed-file.js`: Escrita não destrutiva do export (EP-13.01): bloco entre `harness:begin`/`harness:end`, reescrita só de arquivo com `harness:generated` e validação de caminho.
- `tools/lib/export/claude.js`, `gemini.js`, `local.js`: Planejam o que o export grava em cada destino (ponteiro no `MEMORY.md` do Claude e Knowledge Item em duas fases com resumo e itens isolados para o Gemini).
- `tools/lib/export/data.js`: Coleta `memory.md`, itens estruturados em `memory/`, `instructions.md` e contagem de chats do projeto e resolve os diretórios de destino (injetáveis por variável de ambiente nos testes).
- `tools/lib/export/housekeeping.js`: `--report` (bytes e tokens por destino) e `--prune` (lista arquivos antigos; só remove com `--yes`).
- `tools/lib/memory/item.js`: Contrato do item de memória (EP-13.02): parse, serialização determinística, normalização, hash, slug e validação do frontmatter.
- `tools/lib/memory/harvest/`: Colheita de memórias nativas (EP-13.08): `claude.js` (bullets de MEMORY.md e arquivos isolados sem marcador), `gemini.js` (bullets de ## Gemini Added Memories) e `index.js` (orquestrador com dedupe e guard).
- `tools/lib/memory/lint.js`, `lint-report.js`, `run-lint.js`: Motor de faxina periódica e auditoria da memória declarativa (EP-13.09): duplicatas, caminhos mortos, links órfãos, envelhecimento e teto do índice.
- `tools/lib/engine-monitor/`: Monitor de motores e estados de atividade (EP-09.06): presença (OpenCode / CLI), máquina de estados com dwell time e decaimento temporal, e classificador determinístico.
- `ui/public/js/modules/session-capability-resolver.js`, `central-session-actions.js`, `central-live.js`, `central-action-dispatcher.js`: Navegação, ações, retomada de sessão e stream SSE ao vivo na Central de Sessões (EP-09.04).
- `ui/server/services/attention-queue.service.js`, `ui/server/controllers/central-attention.controller.js`, `ui/public/js/modules/attention-notifier.js`: Fila de atenção e notificações prioritárias da Central de Sessões (EP-09.05).
- `ui/server/services/audit/design-system-audit.service.js`, `ui/public/js/modules/design-audit-ds.js`: Auditoria visual do Design System, detecção de cores hardcoded, emojis e tokens obrigatórios (EP-11.04).
- `scripts/regressao.js`, `tools/types-baseline.js`: Suíte e esteira de regressão com parada na 1ª falha e conferência de baseline de tipos (EP-11.05).
- `.claude/hooks/load-project.ps1`: Injeção de instruções e memória em duas fases via envelope `<memoria_recuperada>` com neutralização contra injeção de tags e fallback via `HARNESS_MEMORY_FORMAT=legacy`.
- Testes: `tests/export-managed-file.test.js`, `tests/export-context.test.js`, `tests/memory-item.test.js`, `tests/memory-harvest.test.js`, `tests/memory-lint.test.js`, `tests/engine-monitor-*.test.js`, `tests/central-session-actions.test.js`, `tests/central-live.test.js`, `tests/central-attention.test.js`, `tests/central-attention-http.test.js`, `tests/design-system-audit.test.js` e `tests/regressao.test.js`.
- `tools/opencode-package.js`: Executa uma história do EP-14 com o opencode num `git worktree` próprio (`--dry-run`, `--verify`); nunca commita nem faz merge.
- `tools/opencode-delegate.js` + `tools/lib/opencode-delegate.js`: governed Codex-to-OpenCode delegation for bounded tasks using only free models, inline configuration, read-only defaults, explicit write/bash capabilities, and no temporary workspace config file.
- `tests/opencode-delegate.test.js`: covers default denials, narrowly enabled capabilities, inline configuration, and refusal of paid models.
- `tools/lib/opencode-package/story.js`, `guard.js`: Leem a história (branch e arquivos permitidos) e conferem se o agente só tocou neles.
- `tools/lib/opencode-package/worktree.js`, `config.js`, `prompt.js`, `run.js`: Worktree em caminho curto, permissões do agente (edição só no worktree, shell restrito a testes), prompt com as regras do repositório e orquestração.
- `tools/add-ds-component.js`, `tools/ds-docs/component-page.js`: Publicam um componente no design system (página, menu, registry, bundle e demo).
- Testes: `tests/opencode-package.test.js` e `tests/add-ds-component.test.js`.

---


## 🧪 5. Como Rodar Testes

```bash
npm test                                           # Roda toda a suíte de testes (Node nativo)
node --test tests/chat-mobile-interaction.test.js  # Testa fidelidade mobile, menus e unificação de chat
node --test tests/server.test.js                   # Testa rotas do servidor HTTP
node --test tests/overview.test.js                 # Testa visão geral e sync
node --test tests/window-manager.test.js           # Testa catálogo, ciclo de vida e foco do Window Manager
node --test tests/design-registry.test.js          # Testa CRUD, validação de manifesto e rotas do Registry
node --test tests/design-tokens.test.js            # Testa variáveis CSS e temas semânticos
node --test tests/design-preview.test.js           # Testa sandbox e renderização isolada de componentes
node --test tests/marco-m1-validation.test.js      # Valida suíte completa do Marco M1 (Extração Confiável)
node --test tests/prototype-schema.test.js         # Testa schema v2, slots nomeados, indexação O(1) e navegação
node --test tests/prototype-state.test.js          # Testa resolução de estado, bindings, interpolação e mocks
node --test tests/prototype-validator.test.js      # Testa validador de integridade e diagnósticos de erros
node --test tests/prototype-canvas-model.test.js    # Testa o modelo do canvas (quadros, grade, câmera, hit-test, Play e persistência)
node --test tests/ds-docs-import.test.js            # Testa o gerador do DS (pids, navegação, scripts, extração)
node --test tests/renderer-components-css.test.js   # Testa a injeção de components.css (só com metadata.dsComponents)
node --test tests/prototype-semantic-parser.test.js # Testa parsing de tags x-import e extração de nós
node --test tests/prototype-screen-decomposer.test.js # Testa decomposição de telas e anotação de data-node-id
node --test tests/prototype-reconstruction.test.js # Testa reconstrução completa do protótipo DIS modular
node --test tests/screen-registry.test.js           # Testa registro das 13 telas, saneamento e cobertura das chaves antigas
node --test tests/screen-state-client.test.js       # Testa hidratação, debounce, migração, reserva offline e retentativa do cliente
node --test tests/chats-screen-state.test.js        # Testa adoção do estado nas telas de conversas, grupos e projetos (EP-14.07)
```

| Caminho | Responsabilidade |
|---|---|
| `scripts/pre-commit.js` | Hook de pre-commit: dados locais, segredos, MAPA, check dos arquivos staged e testes afetados (EP-14.02). |
| `scripts/lib/affected-tests.js` | Mapeia arquivo staged para testes por nome e por `require`/`import` direto; sem mapa, usa o contrato fixo. |
| `.githooks/pre-push` | Roda a suíte completa no push (e a regressão completa quando `quality/regression-enforced` existe). |
| `tests/affected-tests.test.js` | Regressão da seleção de testes afetados, do check restrito e do hook de pre-push. |
| `tests/screen-registry.test.js` | Regressão do registro das 13 telas, do saneamento de campos, do limite de 64 KB e da cobertura das chaves antigas do `localStorage` (EP-14.04). |
| `tests/screen-state-store.test.js` e `tests/screen-state-http.test.js` | Regressão do armazenamento e dos endpoints de estado/histórico por tela: persistência, merge, 409 por `rev`, 413, anel de 500, slug, rotas e arquivos de apoio (EP-14.05). |
| `tests/screen-state-client.test.js` | Regressão do cliente de estado das telas: espelho do registro, hidratação e cache, migração, debounce de 400 ms, `sendBeacon`, reserva offline e retentativa (EP-14.06). |
| `tests/chats-screen-state.test.js` | Regressão da adoção nas conversas, grupos e projetos: hidratação de filtros/visão/página/rascunho/grupos, registro de ações de troca de projeto, abertura de chat e mudança de grupo, além da ausência de `localStorage` direto (EP-14.07). |
| `tests/design-workflows-state.test.js` | Reducer da aba Workflows: catálogo, seleção, plano, dry run, execuções, erro, aviso e ações desconhecidas (EP-08.06). |
| `tests/design-workflows-api.test.js` | URLs e métodos de cada chamada do cliente Workflows (catálogo, plano, execuções, início, avanço e cancelamento) com `fetch` falso e erro de loopback (EP-08.06). |
| `tests/design-workflows-view.test.js` | Renderização do plano em ordem, agente, gate, permissões, skill ausente, escape de texto da API e estados da aba (EP-08.06). |
| `tests/design-workflows-ui.test.js` | Registro da aba em `index.html`/`design.js`, restauração em `design-view-state`, import do CSS, FontAwesome, ausência de emoji e de `confirm`/`alert`/`prompt`, e limite de 300 linhas (EP-08.06). |
| `tests/helpers/temp-dir.js` | Test helper compartilhado que cria um diretório temporário e registra sua remoção, com retries para Windows, para que testes não deixem diretórios na pasta temp do SO. |

- Fixtures de teste: `tests/helpers/project-fixture.js` (orquestrador), `project-fixture-design-system.js`, `project-fixture-prototype.js`, `project-fixture-design-index.js` e `project-fixture-files.js` criam um projeto temporário fora de `projects/` e devolvem `{ dir, slug, cleanup }`.

---
