---
titulo: Plano de commit atômico da worktree
status: em execução
data: 2026-10-20
escopo: Worktree do harness-leca (610 caminhos acumulados)
base: 152b06f
---

# Plano de commit atômico

## 1. Objetivo

Transformar a worktree atual — 610 caminhos acumulados em vários épicos — em uma
sequência de commits temáticos, com mensagens no padrão do repositório e corpo
explicando decisão, regra e testes.

O objetivo não é reconstruir a história real de desenvolvimento, e sim produzir
uma narrativa revisável: cada commit agrupado por decisão técnica, com seus testes
junto, e o topo da branch verde.

## 2. Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Preparação | `git reset` (mixed), preservando a worktree; `logs/` no `.gitignore` |
| Rigor | 21 commits temáticos; topo verde (hubs inteiros nos blocos de base) |
| Documentação | Dossiês, mapas e contextos exportados no bloco final |
| Push / PR | Não autorizados nesta etapa |

## 3. Diagnóstico

- HEAD: `152b06f test(engines): falhar rápido se o servidor não subir`.
- Antes do reset: 401 arquivos staged e 5 `AD` (CSS antigos staged como novos e
  já apagados na worktree), índice impróprio para commit.
- Depois do reset: 34 arquivos rastreados modificados + 165 entradas untracked.
- Quase todo o conteúdo é novo em relação ao HEAD (ex.: `ui/server/router.js`,
  `ui/public/js/modules/*`, `tools/lib/skills/*` não existem no HEAD). O HEAD é
  um baseline antigo; a worktree acumula os épicos EP-01 a EP-12, HIA,
  coordenação multiagente e a reescrita modular da interface.
- Arquivos-hub tocados por vários blocos: `ui/server/router.js`,
  `ui/public/index.html`, `ui/public/js/app.js`, `ui/public/css/index.css`,
  `package.json`, `AGENTS.md`.
- `logs/telemetry/hia-executions.jsonl` estava untracked e não ignorado.
- `global/deploy*.json` já consta no `.gitignore`; nenhum `.env` no diff.

## 4. Baseline (antes do primeiro commit)

| Verificação | Resultado |
|---|---|
| `npm run check` | verde — 549 `.js` e 16 `.json` sem erro |
| `npm test` | 638 testes, 637 passam, 1 falha |
| `npm run types` | 349 erros de tipo já existentes |

Falha pré-existente: `tests/engines.misc.test.js:20` esperava a expressão
`são DADOS do usuário` e o código gerava `sao DADOS`. Corrigida no commit
`feat(hia): adiciona context engine com aviso de dados acentuado`, junto com o
módulo que faltava; a suíte passou a 638/638 antes do primeiro commit temático.

## 5. Regras de commit

- Assunto: `<tipo>(<escopo>): <descrição em minúsculas>`, até 72 caracteres.
- Sem ID de issue (o histórico do repositório não usa `DIS-*`).
- Tipos: `feat`, `fix`, `refactor`, `style`, `test`, `chore`, `docs`.
- Corpo obrigatório em commits de código, em parágrafos:
  1. **O quê** — arquivos e decisão estrutural.
  2. **Por quê** — regra ou problema que motivou.
  3. **Testes** — o que cobre o commit.
- Sem `console.log`, `debugger` ou segredo no diff.
- Teste de reversão: se reverter o commit isoladamente quebrar dois assuntos
  distintos, o bloco precisa ser dividido.

## 6. Fase 0 — preparação (concluída)

- [x] Coordenação verificada: não há história do projeto `saude-dispensacao` para
  manutenção do harness; esta tarefa não usa `claim`.
- [x] `git reset` para limpar o índice inconsistente.
- [x] `logs/` no `.gitignore`.
- [x] Baseline de `check`, `test` e `types` registrado acima.
- [ ] Repetir `npm test` no topo após cada macro-fase (blocos 8, 13 e 21).

## 7. Blocos de commit

Ordem: base → domínios → documentação. Contagem aproximada de arquivos.

| # | Mensagem | Escopo | ~arq. |
|---|---|---|---|
| 1 | `chore(repo): higiene de índice, configuração e telemetria` | `.gitignore`, `jsconfig.json`, `.claude/settings.json`, `scripts/pre-commit.js`, `package.json` | 5 |
| 2 | `refactor(tools): separa importadores e sincronização em módulos` | `tools/lib/{gemini-import,claude-sync-sources,chat-store,sync-core}`, `tools/{sync,daily-journal,import-*}.js`, `tests/{lib,importers.run}*` | 11 |
| 3 | `feat(engines): fortalece catálogo e falhas e integra codex e ollama` | `tools/lib/engines/**`, `tools/lib/{codex-bin,claude-sync-sources}.js`, `tests/engines*`, `tests/golden/**` | 12 |
| 4 | `feat(remote): acesso remoto com pin, qr code e túnel` | `tools/lib/{network*,qrcode*,permissions,project-mcp}.js`, `tools/{tunnel,permission-mcp}.js`, `controllers/{remote,permissions}`, `tests/{remote,permissions}` | 18 |
| 5 | `feat(skills): catálogo e edição de skills por projeto` | `tools/lib/skills/**`, `controllers/skills`, `modules/skills*`, `partials/dialogs-skills.html`, `tests/skills` | 17 |
| 6 | `feat(groups): classificação e sugestão de grupos de conversas` | `tools/lib/{classify,taxonomy,suggest*}.js`, `tools/suggest-groups.js`, `modules/groups*`, `tests/classify` | 11 |
| 7 | `feat(context): exporta contexto e sessões para os agentes` | `tools/{export-context,export-claude-sessions,export-codex-sessions,import-codex-chats,daily-journal}.js`, `tests/{export-claude-sessions,overview}` | 8 |
| 8 | `refactor(server): extrai config, router, controllers e services` | `ui/server.js`, `ui/server/{config,router}.js`, `controllers/{overview,project,review,sync,static,upload,services}`, `services/project*`, `tools/lib/proc-manager*` | ~30 |
| 9 | `feat(design): design system com registry, preview e auditoria de telas` | `controllers/design*`, `services/design-*`, `tools/ds-docs/**`, `tools/import-ds-docs.js`, `modules/design*`, `css/design/**`, `global/design/**`, `tests/design*`, `tests/ds-docs*` | ~55 |
| 10 | `feat(prototype): ateliê, canvas, catálogo e camadas do protótipo` | `controllers/prototype`, `services/prototype-{renderer,storage,structural,version,editor,exporter,sanitizer}`, `modules/prototype*`, `css/design/13-*`, `tests/prototype-{atelier,editor,structural,canvas}` | ~25 |
| 11 | `feat(prototype): schema v2, parser semântico e piloto dis` | `services/prototype-{schema,state,validator,semantic-parser,screen-decomposer,reconstructor,sandbox-renderer,traceability,pilot-dis}`, `schemas/prototype-v2.json`, `tests/prototype-*` | ~20 |
| 12 | `feat(scrum): doze raias, migração e transições de histórias` | `services/project-scrum-*`, `controllers/{scrum,scrum-transition}`, `modules/design-scrum*`, `css/design/09..12`, `tests/{project-scrum*,design-scrum*}` | 42 |
| 13 | `feat(chat): apresentações, execução sincronizada e modelos do chat` | `controllers/{chat,upload}`, `services/{agent-activity,hia-chat-dispatcher}`, `modules/{chat*,mobile-chat}`, `shared/markdown*`, `css/chat/**`, `tests/chat*` | ~51 |
| 14 | `feat(window-manager): janelas, foco, docking e layouts salvos` | `js/window-manager/**`, `types/window-manager.d.ts`, `css/office/12..14`, `tests/{window-*,taskbar,docking,drag-resize,focus-manager,layout-persistence,workspace-*,responsive-layout}` | 16 |
| 15 | `feat(office): escritório com estações, telões e estado dos agentes` | `js/office/**`, `css/office/**`, `office.html`, `tests/office*`, `tests/station-adapter` | 79 |
| 16 | `feat(projects): seleção centralizada e proteção de alterações` | `services/project-selection`, `shared/{project-selection,unsaved-changes}.js`, `tests/{project-selection,unsaved-changes}` | 4 |
| 17 | `feat(studio): layouts, origem de código e visualizações` | `modules/studio*`, `css/studio/**`, `partials/studio*.html`, `controllers/source-workspace`, `services/source-workspace`, `tests/{studio*,source-*}` | 24 |
| 18 | `feat(hia): roteador local, registry de automações e benchmark` | `tools/hia.js`, `tools/lib/hia/**`, `schemas/hia-*`, `controllers/hia`, `modules/hia-dashboard.js`, `css/hia-dashboard.css`, `tests/hia-*` | 13 |
| 19 | `feat(coordination): ledger multiagente com claim, handoff e inbox` | `tools/coordination.js`, `tools/lib/coordination/**`, `tests/coordination`, trecho de `AGENTS.md` | 3 |
| 20 | `feat(deploy): painel de deploy com histórico e terminal` | `controllers/deploy`, `deploy.html`, `js/deploy/**`, `css/deploy/**`, `tests/deploy-render` | 15 |
| 21 | `docs(harness): dossiês de evolução, domínios e setup` | `docs/**`, `MAPA.md`, `README.md`, `SETUP.md`, `CLAUDE.md`, `.agents/skills/**`, `.claude/context/**`, `.gemini/context/**` | 53 |

Sobras (`tests/` e `tools/` sem dono explícito) entram no bloco do domínio
correspondente; a triagem final garante que nada fique fora.

## 8. Arquivos-hub

`ui/server/router.js`, `ui/public/index.html`, `ui/public/js/app.js`,
`ui/public/css/index.css`, `package.json` e `AGENTS.md` pertencem a vários blocos.

Estratégia aprovada (topo verde): os hubs entram inteiros no bloco de base que
primeiro precisa deles (backend no 8, frontend no 9, scripts no 1). Consequência
aceita: commits intermediários podem não inicializar a aplicação; o que se
garante é `npm test` verde nos checkpoints e no topo.

## 9. Riscos e cuidados

1. Nunca usar `git add -A` ou `git add .`: arrasta `logs/` e contextos gerados.
2. `tests/golden/engines-status.json` deve ir junto do bloco 3, senão o teste
   de snapshot quebra.
3. `.claude/context/**` e `MAPA.md` contêm caminhos absolutos da máquina; já é o
   padrão atual do repositório, mas o bloco 21 deve ser revisado antes.
4. Contextos exportados são regenerados ao final (`npm run export:context`), não
   copiados do estado atual.
5. `npm run types` está vermelho desde o baseline (349 erros). Nenhum bloco deve
   piorar esse número; a correção dos tipos é trabalho separado.
6. Não commitar `projects/` (ignorado) nem telemetria.

## 10. Checkpoints

| Checkpoint | Critério |
|---|---|
| Após bloco 8 | `npm test` sem novas falhas |
| Após bloco 13 | `npm test` sem novas falhas |
| Após bloco 21 | `npm run check` verde, `npm test` 638/638, `npm run types` com os 349 erros de baseline, `git status` limpo |

## 11. Registro de execução

Execução concluída em 2026-10-20. Os blocos 5, 6, 9, 10, 12 e 13 foram divididos
em backend e interface, e os marcos de validação e a correção do id de janela
ganharam commits próprios: 36 commits sobre `152b06f`.

| Commit | Assunto |
|---|---|
| `d6f5057` | `feat(hia): adiciona context engine com aviso de dados acentuado` |
| `8d0b9cc` | `chore(repo): higiene de índice, configuração e telemetria` |
| `eecde67` | `test(precommit): cobre a checagem de arquivos fora do mapa` |
| `a2167c8` | `refactor(tools): separa importadores e sincronização em módulos` |
| `97f1253` | `feat(engines): integra codex e ollama e padroniza erros dos motores` |
| `07f7ee8` | `feat(remote): libera acesso remoto com pin, qr code e túnel` |
| `b82c4e3` | `feat(skills): gerencia skills do projeto pela interface` |
| `78d36f5` | `docs(skills): adiciona skills de evolução, inteligência e coordenação` |
| `d2dcb9b` | `feat(groups): classifica conversas e sugere grupos de contexto` |
| `c69dada` | `feat(context): exporta contexto e sessões para os motores` |
| `b1e74eb` | `refactor(server): extrai config, router e controllers do servidor` |
| `575b6b0` | `feat(orchestration): monitora agentes, execuções e serviços locais` |
| `58bd266` | `feat(design): design system com registry, preview e auditoria de telas` |
| `fb782ce` | `feat(prototype): ateliê, canvas e camadas do protótipo` |
| `e934a0a` | `feat(prototype): schema v2, parser semântico e piloto dis` |
| `6dfc7de` | `feat(scrum): doze raias, migração e transições de histórias` |
| `545c99b` | `feat(chat): execução com streaming, apresentações e troca de modelo` |
| `9d8b8ed` | `feat(chat): interface modular com streaming e apresentações` |
| `957962b` | `feat(window-manager): janelas, foco, docking e layouts salvos` |
| `565a20f` | `feat(office): escritório 2D e 3D com estações e telões` |
| `070fb0a` | `feat(projects): seleção centralizada e proteção de alterações` |
| `f710ac7` | `feat(studio): layouts, origem de código e visualizações` |
| `1ad2402` | `feat(hia): roteador local, registry de automações e benchmark` |
| `0e4a722` | `feat(coordination): ledger multiagente com claim, handoff e inbox` |
| `e63eaa9` | `feat(deploy): painel de deploy com histórico e terminal` |
| `da83e0d` | `feat(design): interface do design system, camadas e inspetor` |
| `ba5cca7` | `feat(groups): interface de grupos e classificação de conversas` |
| `eba9a0b` | `feat(skills): telas de listagem, criação e importação de skills` |
| `b78705a` | `feat(scrum): quadro de raias e detalhes de história na interface` |
| `f7c2eca` | `feat(prototype): ateliê, canvas e árvore de camadas na interface` |
| `5d5e748` | `test(prototype): valida marcos M1 a M3 com fixture` |
| `32e72ec` | `feat(ui): casca da aplicação, navegação e páginas de apoio` |
| `e543700` | `docs(harness): dossiês de evolução, domínios e setup` |
| `d918c4c` | `style(studio): adiciona folha agregadora do estúdio` |
| `52c5c22` | `fix(window-manager): gera id único por sequência` |

### Verificação final
- `npm run check`: 549 arquivos `.js` e 16 `.json` sem erro.
- `npm test`: 638 testes, 638 passando, 0 falhando.
- `npm run types`: 349 erros, igual ao baseline.
- `git status`: limpo. Nenhum push ou PR executado.

### Pendências conhecidas
- O id multi-instância do window manager era flaky (colisão de `Date.now()` com
  aleatório); corrigido no commit `52c5c22` após a suíte falhar uma vez.
- `tests/engines.misc.test.js` fixava a mensagem acentuada; a correção veio
  junto do context engine, antes do primeiro commit temático.

## 12. Segunda execução (2026-10-21)

Novo lote acumulado após a execução anterior: EP-03.06 a EP-03.09, EP-05.05 e 05.06,
EP-06.05, EP-07.01 a 07.05, EP-08.01 a 08.05, as fases 1 e 2 do Local AI Runtime e a
telemetria do runtime na interface. Worktree de partida: 211 caminhos (75 modificados,
136 novos).

| Commit | Assunto |
|---|---|
| `f9dbde2` | `feat(runtime): runtime local com Ollama, classificador, shadow e telemetria` |
| `394b516` | `feat(runtime): extracao estruturada local e motor ollama na CLI de artefatos` |
| `aa5aa8b` | `feat(hia): telemetria do runtime local no painel e na API de metricas` |
| `8c857d0` | `feat(office): iluminacao funcional, alternancia de cena, paridade 2.5D e acessibilidade` |
| `455a33c` | `feat(scrum): impedimentos, filtros, metricas e projecao do Kanban no telao` |
| `eb3481e` | `feat(prototype): props, formatacao de codigo, arraste e rastreabilidade modular no atelie` |
| `c7b7194` | `feat(artifacts): inventario, importacao, metadados, previews e relacoes` |
| `3019e51` | `feat(orchestration): capacidades, etapas do SDLC, skills, workflows, aprovacoes e historico` |
| `1f5440f` | `feat(design): arraste de camadas e navegacao por alvo no Mapa em Camadas` |
| `b8fa8ff` | `chore(coordination): atualiza a politica de provedores e alinha a suite` |
| `ee5a3cb` | `chore(dev): scripts ui:dev com watch nativo do Node` |
| `a982458` | `style(ui): agrega as folhas novas de scrum, prototipo, artefatos e escritorio` |
| `c255d1f` | `docs(harness): atualiza indice, progresso e painel de coordenacao` |
| `aa2e943` | `docs(harness): encerra o EP-08 com as rotinas aprovadas e o historico` |
| `eb38407` | `docs(harness): registra as evidencias da 08.05 no progresso e no painel` |
| `9516be4` | `docs(harness): normaliza a codificacao dos documentos de progresso` |
| `ca8c932` | `test(runtime): leva os testes do runtime local para a suite principal` |

### Verificação final
- `npm run check`: 675 arquivos `.js` e 17 `.json` sem erro.
- `npm test`: 831 testes, 830 passando, 1 skip (symlink no Windows).
- `npm run types`: 403 erros (baseline era 349; o código novo acrescentou cerca de 54).
- `git status`: limpo. Nenhum push ou PR executado.

### Decisões desta execução
- **Hubs no fim:** `router.js` e `config.js` entraram junto do bloco de orquestração, para
  que o topo só exista com todas as rotas registradas.
- **Testes da trilha paralela:** a suíte ficou vermelha por causa do EP-08.05 em
  andamento no worktree; os commits intermediários rodaram com `HARNESS_SKIP_TESTS=1`
  (opção do próprio hook) e os commits com verificação completa foram `3019e51` e a
  checagem final do topo.
- **Sem `git add -A`:** todos os blocos foram montados com caminhos explícitos.
- **Suíte honesta:** os testes do runtime local estavam em `test/` (singular), fora do
  glob de `npm test` e do hook; migraram para `tests/` e deixaram de depender da RAM
  real da máquina (`ca8c932`).
- **Trilha paralela preservada:** durante a execução, outra trilha implementing o
  EP-11.01 escreveu no mesmo worktree; os commits deste lote foram montados com caminhos
  explícitos e um hunk isolado do `MAPA.md`, para não capturar trabalho em andamento.

### Pendências conhecidas
- `npm run types` segue vermelho, com a dívida de tipos somada à do baseline.
- A trilha de orquestração (EP-08.05) foi executada em paralelo por outro agente durante
  o lote; o bloco correspondente foi consolidado já com a suíte verde.

