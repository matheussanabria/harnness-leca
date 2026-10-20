# M2 — Capacidades de Controle Operacional (Fase 0)

> **Documento:** Matriz de Operações Suportadas, Pré-condições e Restrições de Controle  
> **Escopo:** Operações acionáveis pelo Centro de Orquestração M2

---

## 1. Princípio Fundamental de Controle do M2

> **Diretriz:** Nenhuma operação será exposta na interface do Centro de Orquestração sem que haja uma implementação comprovada no backend e pré-condições verificáveis. Capacidades ausentes ou não suportadas devem aparecer explicitamente desabilitadas com justificativa transparente ao operador.

---

## 2. Matriz de Ações por Subsistema

| Subsistema / Alvo | Ação Operacional | Endpoint / Mecanismo Real | Pré-condições Verificáveis | Semântica do Resultado |
|---|---|---|---|---|
| **Sincronização Geral** | Sincronizar Todos os Projetos | `POST /api/sync` (com streaming SSE) | Servidor HTTP online; trava de sincronização (`syncRunning === false`). | Inicia execução de `tools/sync.js`. Streaming de log e encerramento com contagens. |
| **Sincronização de Projeto** | Sincronizar Projeto Específico | `POST /api/project/:slug/sync` | `slug` válido em `projects/`; sem sync concorrente para o mesmo slug. | Dispara sync restrito ao projeto selecionado via SSE. |
| **Serviço Local Dev** | Iniciar Serviço (`npm run dev`, `mvn`, etc.) | `POST /api/project/:slug/services/start` | Comando e pasta de execução válidos; serviço não estar em estado `running`. | Spawna processo filho monitorado; armazena PID; transiciona para `starting`/`running`. |
| **Serviço Local Dev** | Parar Serviço | `POST /api/project/:slug/services/stop` | Processo filho ativo com PID conhecido no mapa de processos em memória. | Executa `killTree` (`taskkill /T /F` no Windows); transiciona para `stopped`. |
| **Serviço Local Dev** | Stream de Logs em Tempo Real | `GET /api/project/:slug/services/logs?stream=1` | Conexão SSE mantida pelo cliente. | Envia buffer existente e novos chunks de stdout/stderr via eventos SSE. |
| **Claude Code** | Responder Permissão de Ferramenta | `POST /api/permissions/answer` | Pedido de permissão pendente em memória com ID válido (`id`); resposta dentro do timeout (padrão 120s). | Grava decisão (`allow` / `deny`), escopo (`once`, `chat`, `project`) e desbloqueia a chamada MCP. |
| **Claude Code** | Iniciar Prompt / Conversa | `POST /api/chat` (motor: `claude`) | Binário do Claude Code (`claude.exe`) encontrado no PATH ou `global/.env`. | Inicia subprocesso `claude -p - --output-format stream-json`; streaming SSE para UI. |
| **Claude Code** | Cancelar Prompt em Andamento | Abortar conexão HTTP (`AbortSignal`) | Processo `child` ativo na requisição do chat. | Dispara `killTree(child)` encerrando árvore de processos com segurança. |
| **Gemini** | Iniciar Prompt / Conversa | `POST /api/chat` (motor: `gemini`) | Chave `GEMINI_API_KEY` ou `GOOGLE_API_KEY` no `.env` (ou grava em `bridge/gemini-inbox.jsonl`). | Streaming SSE direto da API do Google AI Studio com histórico de contexto injetado. |
| **Gemini** | Cancelar Prompt em Andamento | Abortar conexão HTTP (`AbortSignal`) | Requisição fetch ativa para a API do Google. | Cancela fetch via `signal.abort()`. |
| **OpenCode** | Iniciar Prompt / Conversa | `POST /api/chat` (motor: `opencode`) | Servidor OpenCode online na porta configurada (padrão `63186`). | Cria sessão `ses_...` via REST e envia `prompt_async`; streaming SSE para UI. |
| **OpenCode** | Cancelar Prompt em Andamento | Abortar conexão HTTP (`AbortSignal`) | Requisição fetch de streaming ativa para o OpenCode. | Cancela conexão HTTP local. |
| **Rotina Agendada** | Disparar Execução Imediata | Invocação no backend de `routines.runProject(slug, { only: arquivo })` | Arquivo `.md` da rotina existente em `projects/<slug>/scheduled/`; sem trava concorrente (`scheduled.lock`). | Executa ação da rotina (prompt, sync ou extração) e grava resultado em `scheduled-state.json`. |
| **Memória & Regras** | Promover Sugestão Extraída | `POST /api/project/:slug/review` (ação: `promote`) | Sugestão existente em `extraido-memorias.md` ou estado pendente; projeto válido. | Formata fato com data `- [AAAA-MM-DD]`, redige segredos, grava em `memory.md` e remove dos pendentes. |
| **Memória & Regras** | Descartar Sugestão Extraída | `POST /api/project/:slug/review` (ação: `discard`) | Sugestão existente; projeto válido. | Registra hash/texto nos descartados para não reaparecer em análises futuras. |

---

## 3. Operações Fora de Escopo / Não Suportadas

As seguintes operações **não possuem suporte técnico viável** na arquitetura atual e **não serão fingidas** pelo M2:

1. **Pausar e Retomar Processo Claude Externo**:
   - Um comando rodando em uma janela independente do terminal (`cmd.exe` ou `powershell` fora do controle do servidor do Harness) não possui API de suspensão e retomada sem risco de corrupção de estado.
2. **Injeção de Comandos em Processo Externo Sem Interface**:
   - Não é seguro nem viável enviar comandos arbitrários no stdin de janelas de terminal desconhecidas sem um canal MCP ou socket dedicado.
3. **Controle de IDE do Gemini Antigravity**:
   - O IDE Antigravity não expõe API REST pública para pausar ou fechar abas de conversa em execução a partir de processos externos. A telemetria é estritamente observacional via `transcript.jsonl`.
4. **Execução Arbitrária de Comandos Shell pelo Navegador**:
   - Por razões de segurança estrita, o frontend nunca poderá enviar comandos shell arbitrários via API HTTP. Apenas comandos explicitamente declarados e parametrizados em arquivos de configuração do projeto (`app.json` / `services` / `scheduled`) são permitidos.

---

## 4. Tratamento de Estados e Idempotência

1. **Solicitações Operacionais Assíncronas**:
   - Cada solicitação de operação recebe um identificador único de rastreio (`operationId`).
   - O backend responde com status claro:
     - `accepted`: Operação válida recebida e despachada para o executor.
     - `completed`: Operação síncrona finalizada com êxito.
     - `rejected`: Operação negada por violação de pré-condição ou autorização.
     - `failed`: Erro durante a execução da operação (com detalhes técnicos sem mascaramento).
2. **Prevenção de Repetição Destrutiva**:
   - Em caso de timeout em conexões de controle, o sistema não reenviará automaticamente comandos destrutivos (como matar processos ou descartar registros) sem validação do estado atual do alvo.
