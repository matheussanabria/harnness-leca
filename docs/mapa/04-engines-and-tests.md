## ⚡ 4. Motores de IA e Extratores (`tools/lib/`)

- [`tools/lib/engines/index.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/index.js): Registro unificado dos motores (`claude`, `gemini`, `opencode`). Todos seguem a interface `{ id, stream, status }`.
- [`tools/lib/engines/codex.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/codex.js): Integra o CLI local do Codex, com retomada de sessão, modelo e intensidade de raciocínio.
- `tools/lib/claude-sync-sources.js`: Reconcilia sessões Claude duplicadas entre workspaces e escolhe uma fonte determinística antes do sync.
- [`tools/lib/dai.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/dai.js): Integração com o esquadrão DAI (17 agentes especialistas) e workflows.
- [`tools/lib/network.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/network.js): Descoberta de IPs locais, geração de QR Code ASCII/SVG e proxies WebSocket.
- [`tools/lib/proc-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/proc-manager.js): Orquestrador de processos em background por projeto.
- `tools/lib/export/managed-file.js`: Escrita não destrutiva do export (EP-13.01): bloco entre `harness:begin`/`harness:end`, reescrita só de arquivo com `harness:generated` e validação de caminho.
- `tools/lib/export/claude.js`, `gemini.js`, `local.js`: Planejam o que o export grava em cada destino (ponteiro no `MEMORY.md` do Claude e Knowledge Item só com a memória curada).
- `tools/lib/export/data.js`: Coleta `memory.md`, `instructions.md` e contagem de chats do projeto e resolve os diretórios de destino (injetáveis por variável de ambiente nos testes).
- `tools/lib/export/housekeeping.js`: `--report` (bytes e tokens por destino) e `--prune` (lista arquivos antigos; só remove com `--yes`).
- `tools/lib/memory/item.js`: Contrato do item de memória (EP-13.02): parse, serialização determinística, normalização, hash, slug e validação do frontmatter.
- Testes: `tests/export-managed-file.test.js`, `tests/export-context.test.js` e `tests/memory-item.test.js`.
- `tools/opencode-package.js`: Executa uma história do EP-14 com o opencode num `git worktree` próprio (`--dry-run`, `--verify`); nunca commita nem faz merge.
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

- Fixtures de teste: `tests/helpers/project-fixture.js` (orquestrador), `project-fixture-design-system.js`, `project-fixture-prototype.js`, `project-fixture-design-index.js` e `project-fixture-files.js` criam um projeto temporário fora de `projects/` e devolvem `{ dir, slug, cleanup }`.

---
