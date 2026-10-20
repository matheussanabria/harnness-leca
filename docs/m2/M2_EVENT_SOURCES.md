# M2 — Matriz de Fontes de Eventos e Telemetria (Fase 0)

> **Documento:** Matriz de Capacidades, Proveniência e Limitações das Fontes de Dados  
> **Escopo:** Claude Code, Gemini (Antigravity), OpenCode, Processos Locais e Rotinas do Harness

---

## 1. Matriz Comparativa por Motor

| Aspecto | Claude Code | Gemini (Antigravity IDE) | OpenCode | Processos Locais (`proc-manager`) | Rotinas Agendadas (`routines`) |
|---|---|---|---|---|---|
| **Localização Física dos Dados** | `~/.claude/projects/<slug>/*.jsonl` | `~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl` | `~/.local/share/opencode/opencode.db` (SQLite) | Memória do processo Node + buffers stdout/stderr | `projects/<slug>/scheduled-state.json` + `projects/<slug>/scheduled/*.md` |
| **Identificador Canônico** | UUID da Sessão (ex: `e74b3f81-5421-4f16-be0d-4ea3f18a5996`) | UUID da Conversa (ex: `62646591-6805-413a-941a-faf72d1ca25f`) | ID da Sessão (`ses_[A-Za-z0-9]{1,64}`) | Chave Composta (`<slug>:<serviceId>`) | Nome do arquivo `.md` da rotina |
| **Estados Fornecidos Explicitamente** | Em execução (se processo vivo via PID), concluído (fim do stream/arquivo estável) | `status` em `PLANNER_RESPONSE` (`DONE`, `ERROR`), tempo de modificação de arquivo | `status` de ferramentas (`error` / `success`), `time_updated` da sessão | `starting`, `running`, `stopped`, `failed`, `exitCode` | `ok`, `falha`, `ativa: false`, `ultima`, `proxima` |
| **Identificação de Início e Término** | Primeiro e último timestamp no arquivo `.jsonl`. Em subprocesso ativo: `child.on('spawn')` e `child.on('close')`. | Campo `created_at` no primeiro `USER_INPUT` e último `PLANNER_RESPONSE`. | Campos `time_created` e `time_updated` na tabela `session`. | `startedAt` (epoch ms) e evento `child.on('exit', code)`. | `ultima` (ISO timestamp) gravado em `scheduled-state.json`. |
| **Histórico Retrospectivo** | Completo linha a linha no `.jsonl` (mensagens, raciocínio thinking, chamadas de tool e tool_results). | Completo no `transcript.jsonl` (passos de planejamento, chamadas de ferramentas e saídas de terminal/editor). | Completo no SQLite: tabelas `session`, `message`, `part` (text, reasoning, tool, state). | Histórico de linhas recentes em ring buffer de memória (`logs[]`). | Última execução gravada no JSON de estado e saídas em `global/routines.log`. |
| **Delegação e Subagentes** | **Explícito**: Flag `e.isSidechain` presente nos eventos de subagentes delegados no `.jsonl`. | **Semi-explícito**: Chamadas de ferramentas `invoke_subagent` ou `browser_subagent` nos `tool_calls`. | **Explícito**: Coluna `parent_id` na tabela `session` vincula diretamente subagente ao agente pai. | Não aplicável (árvore de processos mapeada por `child.pid` e `taskkill /T`). | Cada rotina roda individualmente; sem sub-rotinas explícitas. |
| **Representação de Falhas e Erros** | `b.type === "tool_result"` com `is_error: true`; código de saída não-zero no CLI. | Passo com `status: "ERROR"` e conteúdo explicativo retornado pela ferramenta ou modelo. | Objeto `part.state.status === "error"` no JSON de partes da mensagem. | `status = "failed"`, `exitCode !== 0`, mensagens emitidas no canal `stderr`. | `status = "falha"` no `scheduled-state.json` com texto da mensagem de erro capturada. |
| **Mecanismo de Atualização** | Passivo: observação de `mtime` / leitor de arquivo `.jsonl`. Ativo: stream stdout do CLI (`--output-format stream-json`). | Passivo: observação de `mtime` e leitura do `transcript.jsonl`. Ativo: SSE do Google AI Studio. | Ativo: polling ou webhook no servidor HTTP local (`:63186`). Passivo: query no banco SQLite. | Ativo: listeners de eventos em memória (`info.listeners.add(fn)`). | Ativo: disparo do agendador (`tools/run-scheduled.js`). |
| **Capacidades de Controle Real** | `killTree` (encerra processo), `streamClaude` (inicia chat/prompt), responder permissões MCP (`/api/permissions/answer`). | Iniciar chat via API Studio ou fila bridge local. Interrupção via `AbortSignal`. | Iniciar sessão via `POST /session`, enviar prompt via `/session/:id/prompt_async`. | Iniciar (`startService`), Parar (`stopService` com `killTree`), streaming de logs (`subscribeLogs`). | Disparar rotina imediatamente (`--now <arquivo>`). |

---

## 2. Limitações Críticas e Restrições de Telemetria

### 2.1. Claude Code
- **Sessões Externas no Terminal**: Se o usuário rodar `claude --resume` num terminal independente (fora do controle do servidor do Harness), o Harness não possui handle para o `child_process`. A detecção depende exclusivamente da inspeção do arquivo `.jsonl` em disco e do processo do sistema operacional.
- **Latência de Flush no Disco**: Algumas mensagens podem permanecer em buffer antes de serem descarregadas no `.jsonl`.
- **Ausência de Webhook Nativo**: O CLI do Claude Code não emite webhooks HTTP nativos para o Harness; qualquer atualização passiva depende de file watcher ou monitoramento de `mtime`.

### 2.2. Gemini (Antigravity IDE)
- **Origem dos Dados**: Os logs residem no diretório interno do IDE Antigravity (`~/.gemini/antigravity-ide/brain/<uuid>/.../transcript.jsonl`).
- **Arquivos Truncados**: Arquivos muito longos geram versão token-compactada em `transcript.jsonl` e versão total em `transcript_full.jsonl`.
- **Indisponibilidade de Controle de Processo Externo**: O Harness não tem como matar ou pausar um processo rodando internamente no IDE do Gemini sem uma integração dedicada via MCP ou sidecar.

### 2.3. OpenCode
- **Dependência do Servidor Local**: Para controle ativo (envio de comandos assíncronos), o binário `opencode serve --port 63186` deve estar rodando.
- **Fallback para Leitura SQLite**: Se o servidor do OpenCode estiver fechado, o Harness ainda consegue inspecionar o histórico e o estado das sessões diretamente pelo banco SQLite (`opencode.db`) em modo somente leitura (`readOnly: true`).

### 2.4. Processos Locais (`proc-manager`)
- **Limitação de Memória**: O buffer de logs é mantido em memória (limitado a 500 linhas mais recentes por padrão). Se o servidor do Harness for reiniciado, o histórico de logs não persistido em arquivo é limpo.
- **Processos Órfãos no Windows**: No Windows, comandos executados via shell (`cmd.exe`) podem deixar filhos órfãos se finalizados apenas com `process.kill()`. A solução comprovada já adotada no repositório é o uso de `taskkill.exe /pid <PID> /T /F`.

---

## 3. Classificação de Confiança dos Dados (Confidence Levels)

Para respeitar o princípio de não simular o que não é comprovado, o M2 adotará os seguintes níveis de confiança em todos os eventos:

1. **`explicit`**:
   - Dados vindos de canal de controle direto ou campos formais da fonte (ex: evento SSE recebido de processo filho ativo, linha de log com status de ferramenta, `exitCode` de processo, coluna `parent_id` do SQLite).
2. **`observed`**:
   - Dados confirmados por inspeção de arquivos no sistema operacional (ex: arquivo de log modificado há 15 segundos, tamanho de arquivo em bytes, registros existentes no disco).
3. **`inferred`**:
   - Deduções baseadas em regras de negócio verificáveis (ex: sessão cujo último evento de ferramenta foi há mais de 10 minutos sem novos eventos é inferida como parada ou concluída; projeto associado ao caminho da pasta de trabalho por regex de apelidos).
4. **`unknown`**:
   - Informações que não podem ser comprovadas pelas fontes disponíveis (ex: progresso percentual de uma tarefa de raciocínio interno, consumo de memória de subagente que rodou em nuvem).
