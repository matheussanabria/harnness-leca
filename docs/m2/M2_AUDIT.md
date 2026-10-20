# M2 — Auditoria Técnica da Arquitetura (Fase 0)

> **Data da Auditoria:** 17 de Outubro de 2026  
> **Status:** Concluída com sucesso (Gate de Saída aprovado)  
> **Contexto:** M2 — Centro de Orquestração do DAI HQ (Harness Leca)

---

## 1. Visão Geral da Stack Tecnológica e Restrições Estruturais

A inspeção do repositório confirmou as seguintes diretrizes fundamentais:

1. **Zero Dependências Externas (Node.js Nativo >= 22.13)**:
   - O `package.json` possui **zero dependencies** de produção.
   - Todo o backend roda sobre APIs nativas do Node.js: `node:http`, `node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:sqlite` (nativo do Node 22).
   - Nenhuma biblioteca externa como Express, Socket.io, RxJS ou brokers de mensagens (Redis/RabbitMQ/Kafka) está instalada ou deve ser introduzida sem justificativa extrema.
2. **Arquitetura Frontend (Zero Bundlers / Native ES Modules)**:
   - A interface web em `ui/public/` utiliza **ES Modules nativos** (`import` / `export`) consumidos diretamente pelo navegador (`<script type="module">`).
   - Não há Webpack, Vite, Rollup ou transpilação na UI do Harness. O código deve permanecer compatível com navegadores modernos sem etapa de build.
3. **Padrão de Comunicação em Tempo Real do Projeto**:
   - O projeto adota **Server-Sent Events (SSE)** como padrão canônico para streaming unidirecional de eventos do servidor para o cliente (`Content-Type: text/event-stream; charset=utf-8`).
   - Casos comprovados no código:
     - `/api/chat`: streaming de tokens e raciocínio de LLMs.
     - `/api/sync`: streaming de logs de sincronização de conversas.
     - `/api/project/:slug/services/logs?stream=1`: streaming em tempo real de logs de processos de build e dev.

---

## 2. Mapa dos Componentes e Arquivos Auditados

| Camada / Função | Arquivo Canônico | Responsabilidade Real no Código |
|---|---|---|
| **Entrypoint do Servidor** | `ui/server.js` | Inicialização do servidor HTTP nativo (`createServer`), validação de hostname/origem e delegação para o roteador. |
| **Configuração & Utils HTTP** | `ui/server/config.js` | Porta (padrão 4321), validação de PIN remoto, helpers de resposta (`send`) e leitura de corpo JSON (`readJsonBody`). |
| **Roteador Principal** | `ui/server/router.js` | Tabela `ROUTES` com casamento exato e Regex, autenticação por PIN remoto, proxies para `/preview` e despacho para controllers. |
| **Atividade dos Agentes** | `ui/server/services/agent-activity.service.js` | Função `getActiveAgentsSummary()`. Inspeciona pastas de sessões dos 3 motores e calcula contagens e status. |
| **Estado e Projetos** | `ui/server/controllers/project.controller.js` | Endpoints `/api/state`, `/api/project/:slug`, leitura e atribuição de grupos (`groups.json`) e sugestões de autoclassificação. |
| **Regras de Negócio de Projeto** | `ui/server/services/project.service.js` | Montagem dos metadados de projetos, contagem de conversas em `chats/`, cruzamento com estado de extração (`tools/lib/state.js`). |
| **Gerenciador de Processos** | `tools/lib/proc-manager.js` | Controle de ciclo de vida de processos filhos via `cp.spawn`, eliminação em árvore com `taskkill /T /F` no Windows, buffer circular de logs e pub/sub em memória. |
| **Permissões Interativas** | `tools/lib/permissions.js` / `permissions.controller.js` | Mecanismo loopback onde ferramentas MCP do Claude Code solicitam autorização e a UI (web/mobile) responde via `/api/permissions/answer`. |
| **Rotinas Agendadas** | `tools/lib/routines.js` / `tools/run-scheduled.js` | Leitura de rotinas declaradas em `projects/<slug>/scheduled/*.md`, controle de execução por trava e timestamp em `scheduled-state.json`. |
| **Catálogo DAI Squad** | `tools/lib/dai.js` | Descoberta dinâmica dos 17 agentes especializados DAI a partir de `C:\Users\matheuss.rodrigues\git\DAI\.agents/*/AGENT.md`. |
| **Frontend do Escritório** | `ui/public/office.html` | Estrutura HTML do escritório 3D, viewport WebGL, painéis HUD retráteis, drawer de detalhes e bottom bar. |
| **Orquestração Frontend** | `ui/public/js/office-app.js` | Ponto de entrada modular do escritório, bind de eventos, gerenciador de modos de câmera e alternância do HUD. |
| **Fachada 3D** | `ui/public/js/office-3d.js` | Integração Three.js, avatar jogável em 3ª/1ª pessoa, iluminação, raycasting e ciclo de renderização a 60fps. |
| **Mundo Sala de Guerra** | `ui/public/js/office3d/world-war-room.js` | Construtor da Sala de Guerra (M1), corredor com LEDs, mesa elíptica, hologramas e telão tático. |
| **Renderizador do Telão** | `ui/public/js/office-war-screen.js` | Desenho procedural em canvas 2D dinâmico (1920x1080) projetado como textura de telão militar/tático no Three.js. |
| **Estado Reativo do Escritório** | `ui/public/js/office-state.js` | Singleton reativo `officeState`, polling periódico e distribuição de dados para componentes do escritório. |

---

## 3. Investigação Crítica da Atividade Atual do Escritório

A auditoria identificou disparidades cruciais entre os dados reais do sistema e as estimativas visuais atualmente em vigor:

### 3.1. Análise de `ui/server/services/agent-activity.service.js`
1. **Heurística do Claude Code**:
   - O código verifica arquivos `.jsonl` em `~/.claude/projects/` com `mtime` menor que 8 horas.
   - Se houver arquivos modificados nas últimas 2 horas, calcula contagem.
   - **Discrepância detectada (Linha 115)**: `summary.agents.claude.activeCount = Math.max(veryRecent.length > 0 ? 1 : 0, 1);`
   - O código força `Math.max(..., 1)`! Ou seja, o Claude Code **sempre reporta pelo menos 1 chat ativo**, mesmo que o processo no terminal já tenha terminado há horas.
   - O texto de tarefa é fixo: `"1 chat ativo · Orquestrando workflows no terminal"`.
2. **Heurística do Gemini (Antigravity)**:
   - Verifica subpastas em `~/.gemini/antigravity-ide/brain/` cujo `transcript.jsonl` foi alterado nos últimos 30 minutos.
   - Conta as sessões recentes, mas atribui uma tarefa hardcoded: `"${count} chats ativos · Desenvolvendo Estação 3D & Habbo"`.
3. **Heurística do OpenCode**:
   - Executa consulta no SQLite `~/.local/share/opencode/opencode.db` filtrando `updated_at > now - 30min`.
   - Se houver registros, marca status `"active"`.

### 3.2. Análise de `ui/public/js/office-state.js`
- **Valores default simulados**:
  O objeto inicial possui dados estáticos mockados:
  ```javascript
  activeAgents: {
    totalActive: 3,
    agents: {
      claude: { name: "Claude Code", activeCount: 1, status: "active", currentTask: "1 chat ativo · Orquestrando no terminal" },
      gemini: { name: "Gemini", activeCount: 2, status: "active", currentTask: "2 chats ativos · Construindo Escritório 3D" },
      opencode: { name: "OpenCode", activeCount: 0, status: "idle", currentTask: "Em espera" }
    }
  }
  ```
  Se houver falha de rede ou antes do primeiro fetch completar, a interface exibe essa simulação como se fosse real.
- **Mecanismo de Atualização Atual**:
  Polling rígido a cada 8 segundos (`setInterval(..., 8000)`), consumindo `/api/agents/active`.

---

## 4. Conclusões da Auditoria para o M2

1. **Separar Fato Observado de Heurística**:
   O Centro de Orquestração M2 **não pode** herdar a regra de forçar `activeCount = 1` para o Claude nem strings de tarefas inventadas. Cada evento deve conter explicitamente o nível de confiança (`explicit`, `observed`, `inferred`).
2. **Uso de SSE para Observabilidade Contínua**:
   Em vez do polling cego a cada 8s que lê o disco continuamente, o M2 deve expor um endpoint SSE `/api/orchestration/stream` com heartbeat e push sob demanda quando novos eventos forem detectados.
3. **Aproveitamento da Infraestrutura Existente**:
   O `proc-manager.js` já possui rastreamento real de processos filhos (PIDs, status, exitCode, streams de stdout/stderr). Esse serviço servirá de base concreta para tarefas e processos locais reais.
