# 01 - Auditoria do estado atual (F0)

Fase F0 da iniciativa Harness Intelligence. Somente leitura: nenhuma alteracao de producao foi feita para produzir este relatorio. Tokens estimados com 4 caracteres por token (hipotese de ordem de grandeza, nao medicao do provedor).

Legenda: **[Fato]** observado em arquivo ou comando citado. **[Hipotese]** a validar. **[Lacuna]** nao verificado.

Contexto relacionado: `docs/harness-evolution/01-current-state-audit.md` audita o produto (UI, Scrum, Studio) e nao o consumo de IA; este documento nao o repete.

## 1. Resumo

1. [Fato] O contexto estatico injetado por mensagem e pequeno (~0,9K tokens). A hipotese de que a duplicacao de instrucoes e a causa principal do esgotamento das cotas **nao se sustenta** para a injecao estatica.
2. [Fato] Os motores do Harness nao capturam tokens, custo ou cota, mas os arquivos de sessao locais do Claude Code e do Codex trazem uso reportado. A linha de base preliminar (secao 3.1) foi montada deles, sem chamadas novas.
3. [Fato] Chamadas de LLM em lote (extracao, consolidacao, sugestao, rotinas) passam por `claude -p` ou OpenCode e sao candidatas a script ou modelo local.
4. [Fato] O ambiente nao tem Ollama, Docker nem WSL2. A premissa de infraestrutura do plano nao se confirma.
5. [Fato] O Codex reporta 100% da janela semanal usada. No Claude, ~69% das chamadas dos ultimos 14 dias (2.234 de 3.236) vieram de subagentes.
6. [Hipotese] Os maiores consumidores estao em arquivos que os agentes leem inteiros (`MAPA.md`, prompt do orquestrador DAI, `context/extraido-*.md`), no fan-out de subagentes e no uso interativo, nao no hook.

## 2. Inventario tecnico

### 2.1 Motores e fluxo

| Item | Evidencia |
|---|---|
| Interface de motor `{ id, stream, status }`; 4 motores: Claude, OpenCode, Gemini, Codex | `tools/lib/engines/index.js` |
| Catalogo de modelos e metadados | `tools/lib/engines/catalog.json` |
| Claude: processo `claude` por requisicao via `spawn`, prompt por stdin | `engines/claude.js:44-61` |
| Codex: `codex exec` (ou `exec resume`) via `spawn` | `engines/codex.js:36-42` |
| OpenCode: servidor local (porta 63186) via HTTP | `engines/opencode.js`, `package.json` (script `opencode`) |
| Gemini: API do AI Studio por `fetch`, ou modo Bridge em arquivo | `engines/gemini.js:36-65`, `bridge/` |
| Classificacao de erros, inclui deteccao de limite de cota | `engines/errors.js:31-32` |

Fluxo: UI envia motor, contexto, historico e configuracoes a `POST /api/chat`; o controller escolhe o motor por `engines.get(id)` e devolve SSE (`ui/server/controllers/chat.controller.js`).

### 2.2 Contexto injetado

| Origem | Tamanho | Tokens (est.) | Quando |
|---|---:|---:|---|
| `global/instructions.md` | 1.377 B | ~344 | Hook por mensagem; `getProjectContext` |
| `global/memory.md` | 1.681 B | ~420 | idem |
| `projects/harness-leca/instructions.md` | 122 B | ~30 | idem |
| `projects/harness-leca/memory.md` | 299 B | ~75 | idem |
| **Subtotal injetado** | **3.479 B** | **~870** | |
| `AGENTS.md` | 5.033 B | ~1.258 | Lido pelo agente no inicio da tarefa (sem hook) |
| `CLAUDE.md` | 2.029 B | ~507 | Lido pelo agente |
| `MAPA.md` | 61.013 B | ~15.250 | Citado como indice obrigatorio |

Mecanismos [Fato]:
- Hook `UserPromptSubmit` injeta instrucoes e memorias a cada mensagem (`.claude/hooks/load-project.ps1:23-46`); lista os nomes de `context/`, sem o conteudo.
- Claude, Codex e OpenCode injetam o contexto **somente no primeiro turno** de uma sessao; turnos seguintes retomam a sessao (`claude.js:36-39`, `codex.js:40`, `opencode.js:53-56`).
- Gemini via API reenvia o contexto como `system_instruction` e ate 40 turnos de historico **a cada requisicao**, sem sessao (`gemini.js:37-57`).

### 2.3 Arquivos grandes sob demanda

| Arquivo | Tamanho | Tokens (est.) |
|---|---:|---:|
| `projects/harness-leca/context/extraido-conversas.md` | 138.684 B | ~34.700 |
| `context/extraido-regras.md` | 30.754 B | ~7.700 |
| `context/extraido-indice.md` | 26.452 B | ~6.600 |
| `context/extraido-arquivos.md` | 18.252 B | ~4.560 |
| `dai/.agents/00-sdlc-orchestrator-prompt.md` | 34.950 B | ~8.740 |
| 17 `AGENT.md` do DAI | 1.770 a 5.157 B cada | ~440 a ~1.290 cada |

[Fato] Nenhum desses entra automaticamente no hook; so contam se o agente os abrir. [Hipotese] Abrir `MAPA.md` inteiro e o maior custo fixo por tarefa de agente.

### 2.4 Scripts e automacoes existentes (reutilizaveis)

| Capacidade | Evidencia |
|---|---|
| Classificacao de temas sem modelo e sem rede (F1 medido 0,22 para ~0,5 contra gabarito de 29 conversas) | `tools/lib/classify.js:1-5`, `taxonomy.js` |
| Ledger de coordenacao entre agentes (claim, handoff, inbox) | `tools/coordination.js`, `tools/lib/coordination/` |
| Sincronizacao e importacao de conversas dos motores | `tools/sync.js`, `tools/import-*.js` |
| Exportacao de contexto e sessoes | `tools/export-context.js`, `export-claude-sessions.js` |
| Mascara de segredos | `tools/lib/redact.js` |
| Permissoes por MCP | `tools/permission-mcp.js`, `tools/lib/permissions.js` |
| Rotinas agendadas | `tools/lib/routines.js`, `tools/run-scheduled.js` |
| Gerenciador de processos e portas | `tools/lib/proc-manager-*.js` |
| Integracao com agentes DAI | `tools/lib/dai.js` |

Inventario completo de funcionalidades reutilizaveis: pendente (HIA-002).

### 2.5 Chamadas de LLM em lote

[Fato] `tools/lib/llm.js` (`ask`) e usado por: `tools/consolidate-memory.js`, `tools/extract-artifacts.js`, `tools/lib/routines.js:180`, `tools/lib/suggest.js:131`. Cada chamada executa `claude -p --tools ""` ou `opencode run` com modelo gratuito por padrao (`llm.js:16,41-90`). O Claude e chamado com o modelo padrao da conta quando `--model` nao e informado (`llm.js:45`).

[Fato] O repositorio tem 474 arquivos em `projects/harness-leca/chats/`, o que dimensiona a carga da extracao.

## 3. Metricas disponiveis

| Motor | Uso de tokens capturado hoje | Evidencia |
|---|---|---|
| Claude | Nao | busca por `usage`, `input_tokens`, `cost` em `engines/`: sem ocorrencias |
| Codex | Nao | idem |
| Gemini | Nao | idem |
| OpenCode | Nao | idem |

[Fato] O unico sinal de cota nos motores do Harness e a deteccao de erro de limite em `errors.js:31`.

### 3.1 Linha de base preliminar (HIA-003)

Fonte: sessoes locais `~/.claude/projects` (1.368 arquivos tocados em 14 dias) e `~/.codex/sessions`, agregadas por script de rascunho somente leitura, sem ler conteudo. Dados **reportados** pelas ferramentas; nao sao cota de assinatura. Janela: 06 a 19/10/2026.

**Claude Code** (3.236 chamadas com uso, deduplicadas por id):

| Modelo | Chamadas | Saida | Cache lido | Cache escrito |
|---|---:|---:|---:|---:|
| claude-sonnet-5-5 | 2.889 | 1,07 M | 463,7 M | 15,5 M |
| claude-opus-5-5 | 344 | 0,11 M | 49,7 M | 1,5 M |
| claude-haiku-5-5 | 3 | ~0 | 0,03 M | 0,04 M |

Pico: 14 e 15/10 (804 e 555 chamadas; 106 M e 190 M de cache lido). Tokens de entrada nao cacheados sao ~0.
Origem: subagentes 2.234 chamadas (253 M de cache lido), ou ~69% das chamadas; workspace em `Desktop/harness-leca` 531 chamadas (0,71 M de saida); `git/harness-leca` 300 chamadas.

**Codex** (43 sessoes, acumulado por sessao): entrada 223,3 M, dos quais 216,4 M em cache (96,9%); saida 0,93 M; raciocinio 0,21 M. `rate_limits` do ultimo evento: janela de 10.080 min (semanal) com `used_percent = 100`.

**Leitura e ressalvas**
- [Fato] A entrada nova e quase toda servida por cache; repeticao de instrucoes tem custo baixo para o provedor. Reforca que o hook (~870 tokens) nao e o problema.
- [Fato] Subagentes concentram o volume do Claude. O fan-out de agentes DAI e o primeiro alvo de politica.
- [Hipotese] A cota de assinatura pondera saida e escrita de cache mais que leitura de cache; o peso real nao e publicado e nao foi medido. Nao converter estes numeros em percentual de cota.
- [Lacuna] Gemini e OpenCode nao tem sessao local analisada. O Codex agrega sessoes por data do ultimo evento; sessoes longas atravessam dias.
- [Lacuna] O workspace `Desktop/harness-leca` e distinto de `git/harness-leca`; confirmar se e uma copia ativa antes de comparar.
- Procedimento reproduzivel: transformar o rascunho em `tools/` fica para depois da aprovacao da F1 (nao e codigo de producao desta fase).

## 4. Concorrencia, retries e loops

- [Fato] Um processo ou requisicao por mensagem; nao ha fila nem limite de concorrencia no codigo dos motores (busca por `queue`, `concurrency`, `maxRetries` em `engines/`: sem ocorrencias).
- [Fato] `retryable` em `errors.js` apenas sinaliza para a UI; nao ha retry automatico.
- [Fato] Gemini troca de modelo automaticamente em 503 e 429 para `gemini-3-flash-preview` (`gemini.js:67-70`). E um fallback automatico entre modelos do mesmo provedor; a diretriz 11 do plano exige politica explicita.
- [Lacuna] Deteccao de loops e perda de contexto entre sessoes nao foram investigadas.

## 5. Infraestrutura

| Item | Plano | Observado | Evidencia |
|---|---|---|---|
| CPU | Ryzen 5 7430U, 6/12 | Confirmado | `Win32_Processor` |
| RAM | 16 GB | 14,8 GB utilizaveis | `Win32_ComputerSystem` |
| GPU dedicada | Nao | Nao verificado alem da CPU com Radeon integrada | `Win32_Processor` |
| Node | - | v24.22.0 (projeto exige >= 22.13) | `node -v`, `package.json` |
| Ollama | Runtime inicial | Nao encontrado no PATH | `Get-Command ollama` |
| Docker | Disponivel | Nao encontrado no PATH | `docker --version` |
| WSL2 | Disponivel | Nao instalado | `wsl --status` |
| Hypervisor | - | `HypervisorPresent = False` | `Win32_ComputerSystem` |

[Hipotese] O Ollama possui versao nativa para Windows e dispensa WSL2 e Docker; confirmar na documentacao oficial na F4. Nao instalar sem autorizacao (diretriz 9).

## 6. Conformidade com as regras do repositorio

- [Fato] Nenhum `.js` em `tools/`, `ui/server/` e `ui/public/js/` passa de 300 linhas, exceto o vendor `OrbitControls.js` (677).
- [Fato] `tools/lib/dai.js` usa emojis em `DAI_WORKFLOWS` e como icone padrao (`dai.js:41,95-120`), contra a regra do `AGENTS.md`. Fora do escopo desta iniciativa; registrado.
- [Fato] `dai.js:8` fixa `C:\Users\matheuss.rodrigues\git\DAI` como padrao (a pasta e `dai`; funciona no Windows por ser insensivel a maiusculas). Pode ser sobrescrito por `DAI_PATH`.
- [Fato] O DAI tem 17 agentes em `.agents/` (a contagem do plano esta correta; uma mensagem anterior desta conversa informou 16 por engano).

## 7. Matriz: existente, reutilizavel, novo

| Modulo alvo | Existente | Reutilizar | Novo |
|---|---|---|---|
| Automation Registry | Scripts em `tools/` sem contrato uniforme | `tools/lib/cli.js`, `permissions.js`, `redact.js` | Catalogo com schema, timeout, permissao |
| Script Executor | `proc-manager-*.js`, `spawn` nos motores | `proc-manager-run.js` | Executor com allowlist |
| Context Engine | `getProjectContext`, `classify.js`, `taxonomy.js` | `state.js`, `chat-format.js` | Indice incremental e recuperacao seletiva |
| Local Model Adapter | Nenhum | Padrao `{ id, stream, status }` dos motores | Adapter Ollama |
| Model Registry | `engines/catalog.json` | O proprio catalogo | Campos de custo e capacidade |
| Benchmark Runner | Nenhum | `tests/` (`node:test`) | Datasets versionados |
| Intelligent Router | Escolha manual do motor na UI | `engines.get(id)` | Politica de roteamento |
| Resource Governor | Nenhum | `proc-manager-*.js` | Limites de CPU, RAM e concorrencia |
| Execution Guard | `errors.js` (classificacao) | `errors.js` | Fila, retry com teto, checkpoint |
| Telemetry | Nenhum | Eventos de coordenacao (`events/`) | Coleta de uso e cache |

## 8. Gargalos e oportunidades por impacto

| # | Item | Tipo | Impacto estimado | Esforco |
|---|---|---|---|---|
| 1 | Politica para fan-out de subagentes (69% das chamadas do Claude): limitar paralelismo, escolher modelo menor por papel, exigir contexto minimo | Oportunidade | Alto | Medio |
| 2 | Tornar a linha de base reproduzivel e continua (hoje e rascunho; Gemini e OpenCode sem dados) | Oportunidade | Alto: habilita todo o resto | Baixo |
| 3 | Tirar extracao, consolidacao e sugestao do `claude -p` (script primeiro, local depois) | Oportunidade | Alto, se confirmada a frequencia | Medio |
| 4 | Dividir `MAPA.md` em indice curto mais areas | Oportunidade | Medio a alto por tarefa de agente | Baixo |
| 5 | Capturar uso (tokens, tentativas, tempo) nos motores do Harness | Lacuna | Alto | Medio |
| 6 | Limitar historico do Gemini API e usar cache de contexto | Oportunidade | Medio | Baixo |
| 7 | Politica explicita para fallback automatico do Gemini | Risco | Baixo, mas viola a diretriz 11 | Baixo |
| 8 | Prompt do orquestrador DAI (~8,7K tokens) so sob demanda | Oportunidade | Medio | Baixo |

## 9. Riscos

- Medir antes de agir: sem linha de base, qualquer percentual de economia seria invencao.
- Modelos locais em CPU com 14,8 GB de RAM competem com IDE, navegador e servidor do Harness.
- Mexer em `getProjectContext` afeta os 4 motores; exige feature flag e fallback.
- Divisao de `MAPA.md` precisa manter a regra do `CLAUDE.md` de atualizar o mapa a cada arquivo novo.

## 10. Perguntas pendentes

1. O hook `UserPromptSubmit` tambem dispara quando o Harness inicia o Claude Code por `engines/claude.js`, duplicando o contexto de `getProjectContext`? Nao verificado (a funcao `claudeSession` define o `cwd`).
2. Qual o peso de cada tipo de token na cota de assinatura (saida, escrita e leitura de cache)? Nao e publicado; so se estima por correlacao com `rate_limits` ao longo do tempo (Codex expoe o campo).
3. Qual a frequencia real das rotinas agendadas e das extracoes em lote?
4. Autoriza instalar o Ollama nativo para a F4, ou prefere medir antes com a infraestrutura atual?
5. Politica desejada para o fallback automatico de modelo do Gemini.

## 11. Proximos passos propostos (sem executar)

Aprovada esta auditoria: HIA-003 (linha de base) e HIA-002 (inventario completo) em paralelo, depois F1 (contratos). Referencias: `README.md` deste dossie.
