# Validação documental e instalação / Documentation and installation validation

Data / Date: 2026-11-16.

## Atualização: clone independente / Update: independent clone

**Português:** uma segunda validação usou um clone local independente em pasta temporária fora do repositório, no mesmo computador, baseado em `f171fba` com a correção de isolamento de `tests/harness-gates-mapa.test.js` aplicada. A correção permanece no worktree `docs/install-audit`, sem commit ou integração à árvore principal. Os registros anteriores abaixo são preservados como histórico.

**English:** a second validation used an independent local clone in a temporary directory outside the repository, on the same computer, based on `f171fba` with the isolation fix to `tests/harness-gates-mapa.test.js` applied. The fix remains in the `docs/install-audit` worktree, without a commit or integration into the main checkout. Earlier results below are retained as history.

| Verificação / Check | Resultado / Result |
|---|---|
| `npm ci --no-audit --no-fund` | Aprovado / Passed: 278 pacotes / packages. |
| `npm run build:web` | Aprovado / Passed; aviso de chunks grandes / large-chunk warning. |
| `npm run types:web` | Aprovado / Passed. |
| `npm run lint:web` | Aprovado / Passed: 82 arquivos / files. |
| `npm test`, após instalação / after installation | 2.696 passaram / passed; 0 falhas / failures; 4 ignorados / skipped. |
| Adoção / Adoption | Simulação, criação e ativação de `onboarding-example` aprovadas / dry run, creation and activation passed. |
| HTTP local | `/` e / and `/api/project/onboarding-example`: 200. |
| `npm run e2e:web`, `E2E_PORT=44329` | Seis verificações aprovadas / six checks passed. |

**Português:** o primeiro E2E teve timeout esperando o contador do laboratório; a repetição em outra porta passou, mas a causa não foi comprovada. Uma rodada de testes iniciada antes de terminar a instalação falhou em três casos de lint; os cinco testes desse arquivo e depois a suíte completa passaram após o npm terminar. Execute instalação, testes e build em sequência. O npm reportou avisos de peer dependencies transitivas e depreciação do KaTeX instalado; não foram atualizadas dependências. Não foi executada auditoria de vulnerabilidades.

**English:** the first E2E timed out waiting for the lab counter; retrying on another port passed, but the cause was not established. A test run started before dependency installation finished failed in three lint cases; all five tests in that file and then the full suite passed after npm completed. Run installation, tests and build sequentially. npm reported transitive peer-dependency warnings and deprecation of the installed KaTeX version; dependencies were not upgraded. No vulnerability audit was run.

**Português:** autenticação com novas contas, importação/exportação real e instalação em outro computador continuam fora do escopo validado. O clone e o worktree foram preservados. A correção remove variáveis `GIT_*` herdadas tanto da chamada Git quanto dos subprocessos Node, reutilizando os helpers existentes; 12 testes direcionados passaram e houve revisão independente.

**English:** fresh-account authentication, real import/export and installation on another computer remain outside the validated scope. The clone and worktree were retained. The fix removes inherited `GIT_*` variables from both direct Git calls and Node subprocesses using existing helpers; 12 targeted tests passed and the change received independent review.

## Português

A validação foi realizada em Windows, Node 26.13.1 e npm 11.20.0. Foi criado o worktree `.codex/worktrees/docs-install-audit`, branch `docs/install-audit`, no commit `f171fba`. Esse checkout separa a verificação das alterações locais não commitadas; não representa uma máquina recém-instalada.

| Verificação | Resultado |
|---|---|
| Requisitos e lockfile | Inspeção dos manifestos não encontrou incompatibilidade entre o mínimo Node declarado e os requisitos do Vite. |
| `node tools/mapa.js check` na árvore principal | Aprovado: zero erros e zero órfãos no conjunto verificado, após mapear os 232 arquivos inicialmente sem cobertura; 14 avisos de mapas legados. |
| `npm run check` no worktree | Aprovado: 1.491 arquivos JavaScript e 42 JSON. |
| `npm test` no worktree, fora do sandbox | 2.700 testes: 2.695 passaram, 1 falhou, 4 ignorados. |
| Primeira rodada dentro do sandbox | Também apresentou erros EPERM; não foi usada como resultado definitivo. |

A falha reproduzível está em `tests/git-isolation-guard.test.js`: `tests/harness-gates-mapa.test.js` executa Git sem usar `tests/helpers/git-sandbox.js`, exigido pelo guard. O código não foi alterado nesta auditoria. A suíte completa ainda não está aprovada nesse commit.

Não foram executados `npm ci`, build React, testes visuais, autenticação de motores nem primeira importação/exportação com contas novas. Portanto, a instalação do zero permanece parcialmente validada. Um worktree sob a árvore principal pode encontrar dependências em diretórios ancestrais; não equivale a um ambiente sem dependências.

O mapa distingue agora artefatos locais de design dos consumidores versionados. Os novos documentos foram reconhecidos pelo validador com `git add --intent-to-add`, sem commit. Os mapas adicionais descrevem responsabilidades em português e inglês. Avisos dos mapas antigos sem frontmatter continuam pendentes de migração.

Limite do verificador: a cobertura automática considera arquivos versionados JS/MJS/CJS/CSS/HTML em `ui/`, `tools/` e `scripts/`. Um resultado sem órfãos nesse conjunto não comprova cobertura de TypeScript/TSX, testes ou todos os documentos.

Próximos passos: corrigir o teste de isolamento em mudança própria; validar instalação de dependências e build em diretório sem dependências ancestrais; executar o roteiro inicial com projeto de exemplo; migrar mapas legados e ampliar a cobertura verificada.

## English

Validation ran on Windows with Node 26.13.1 and npm 11.20.0. The `.codex/worktrees/docs-install-audit` worktree was created on branch `docs/install-audit` at commit `f171fba`. This separates verification from uncommitted local changes; it is not a freshly installed machine.

| Check | Result |
|---|---|
| Requirements and lockfile | Manifest inspection found no incompatibility between the declared Node minimum and Vite requirements. |
| `node tools/mapa.js check` in the main checkout | Passed: zero errors and zero orphans in the checked set after mapping the 232 initially uncovered files; 14 legacy-map warnings remain. |
| `npm run check` in the worktree | Passed: 1,491 JavaScript files and 42 JSON files. |
| `npm test` in the worktree outside the sandbox | 2,700 tests: 2,695 passed, 1 failed, 4 skipped. |
| Initial sandbox run | Also encountered EPERM errors; not used as the definitive result. |

The reproducible failure is in `tests/git-isolation-guard.test.js`: `tests/harness-gates-mapa.test.js` invokes Git without the required `tests/helpers/git-sandbox.js` helper. No code was changed during this audit. The full suite does not pass at this commit.

Dependency installation through `npm ci`, React build, visual tests, engine authentication and initial import/export with fresh accounts were not run. Clean installation therefore remains partially validated. A worktree nested under the main repository may resolve dependencies from ancestor directories; it is not a dependency-free environment.

The map now distinguishes local design artifacts from tracked consumers. New documents were made visible to the checker through `git add --intent-to-add`, without a commit. Additional maps describe responsibilities in Portuguese and English. Legacy maps without frontmatter still need migration.

Checker limitation: automatic coverage includes tracked JS/MJS/CJS/CSS/HTML files under `ui/`, `tools/` and `scripts/`. Zero orphans within that set does not prove coverage of TypeScript/TSX, tests or every document.

Next steps: fix the isolation test in a separate change; validate dependency installation and build in a directory without ancestor dependencies; run onboarding with a sample project; migrate legacy maps and expand checked coverage.
