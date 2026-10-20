# 02 - Arquitetura Alvo: Intelligence & Automation (F1)

**Status:** Proposta (Fase F1) | **Data:** 2026-10-19 | **Estratégia:** Script-First · Local-First · Cloud-on-Demand

---

## 1. Visão Geral e Princípios Fundamentais

O objetivo da camada de Intelligence & Automation (HIA) é transformar o Harness Leca de um mero despachante de prompts em uma plataforma cognitiva e computacional eficiente. A meta técnica primordial é resolver tarefas determinísticas sem LLM, tarefas semânticas rotineiras via inferência local em CPU, reservando os motores de nuvem (Claude, Codex, Gemini e OpenCode) estritamente para raciocínios de alta complexidade autorizados.

```
+-----------------------------------------------------------------------------------+
|                        Interfaces do Harness Leca                                 |
|          (Chat Interativo · Vibecoding Studio · Scrum · Escritório 3D)            |
+-----------------------------------------------------------------------------------+
                                          |
                                    [HiaTask]
                                          v
+-----------------------------------------------------------------------------------+
|                       Task Orchestrator & Intelligent Router                      |
|      (Classificação semântica · Avaliação de Orçamento · Políticas de Seleção)    |
+-----------------------------------------------------------------------------------+
        |                                 |                                 |
   (Determinística)                (Semântica Leve)                (Alta Complexidade)
        v                                 v                                 v
+-----------------------+     +-----------------------+     +-----------------------+
|    Script Engine      |     |     Local Engine      |     |     Cloud Engine      |
| (Automation Registry) |     |  (Ollama Local CPU)   |     | (Claude, Codex, etc.) |
|  Git, AST, MCP, Sync  |     | Qwen2.5-Coder / Qwen3 |     | Contexto Mínimo / SSE |
+-----------------------+     +-----------------------+     +-----------------------+
        \                                 |                                 /
         +--------------------------------+--------------------------------+
                                          |
                                    [Execution]
                                          v
+-----------------------------------------------------------------------------------+
|           Resource Governor · Context Engine · Telemetry & Quality Guard          |
|    (Confinamento Path/RAM · Deteção de Loops · Deduplicação · Logs Estruturados)  |
+-----------------------------------------------------------------------------------+
```

### Princípios de Engenharia
1. **Reutilização Estrita:** Nada de duplicar o que já existe em `tools/lib/` (classificador semântico `classify.js`, ledger `coordination.js`, ofuscador `redact.js`, gerenciador `proc-manager.js`).
2. **Anti-Monólito (< 300 linhas):** Cada módulo, adapter ou serviço deve possuir responsabilidade única (SRP), preferencialmente até 200 linhas, teto estrito de 250 a 300 linhas.
3. **Padrão Visual:** Proibição de emojis em interfaces e logs estruturados; somente ícones FontAwesome (`fa-solid` / `fa-regular`).
4. **Resiliência e Fallback Transparente:** Nenhuma falha de serviço local pode travar a aplicação, e nenhum fallback para a nuvem pode ocorrer sem autorização visível ao usuário.

---

## 2. Decomposição Modular e Responsabilidades

### 2.1 Task Orchestrator & Intelligent Router (`tools/lib/hia/router.js`)
- **Responsabilidade:** Receber requisições brutas (da UI ou de scripts), tipificá-las conforme o contrato `schemas/hia-task.schema.json` e decidir o executor ótimo.
- **Entradas:** `prompt`, `slug` do projeto, `daiAgent`, histórico recente, restrições de orçamento.
- **Saídas:** Decisão de rota (`route: "script" | "local_llm" | "cloud"`, `targetId`, `reason`).
- **Integração:** Reutiliza `tools/lib/classify.js` e a taxonomia de `taxonomy.js` para categorização por regras determinísticas em O(1), sem gastar tokens.

### 2.2 Automation Registry & Script Executor (`tools/lib/hia/registry.js` e `executor.js`)
- **Responsabilidade:** Catalogar e executar ferramentas determinísticas com schema estrito (`schemas/hia-tool.schema.json`), isolamento de processo e timeouts claros.
- **Ferramentas Iniciais no Registry:**
  - `git.status_summary`: Leitura de diffs e commits sem abrir subshell desprotegido.
  - `repo.syntax_check`: Execução do `scripts/check.js`.
  - `taxonomy.classify_chat`: Classificação estática de tags sem modelo generativo.
  - `memory.extract_rules`: Extração regex/AST de regras e termos duráveis.
  - `coordination.sync_state`: Sincronização do ledger local.
- **Garantias:** Validação de argumentos via schema, bloqueio de `rm -rf` / deleções sem aprovação (`permissions.js`).

### 2.3 Context Engine & Selective Indexer (`tools/lib/hia/context-engine.js`)
- **Responsabilidade:** Substituir a injeção genérica ou leitura de arquivos monolíticos (`MAPA.md`, `extraido-conversas.md`) por fatiamento mínimo sob demanda.
- **Mecanismos:**
  - Injeção por escopo: `none`, `minimal` (apenas memória ativa), `project_only` ou `full`.
  - Indexador incremental: hashes de arquivos de contexto para evitar releitura e remontagem desnecessária de tokens.
  - Supressão de prompts repetidos: reaproveitamento do cache de prefixo já existente nos motores.

### 2.4 Local Model Adapter (`tools/lib/engines/ollama.js`)
- **Responsabilidade:** Adapter canônico compatível com a interface unificada de motores `{ id: "ollama", stream(req), status(catalog) }`.
- **Comunicação:** Chamadas HTTP REST para o daemon local Ollama (`http://localhost:11434/api/generate` e `/api/chat`).
- **Configuração de Hardware Profiler:**
  - Limite de concorrência: 1 inferência por vez.
  - Contexto inicial: 2K–4K tokens.
  - Threads de CPU: configurável entre 4 e 6 threads (respeitando a CPU Ryzen 5 7430U de 6 núcleos/12 threads sem travar o Windows).

### 2.5 Model Registry (`tools/lib/hia/model-registry.js`)
- **Responsabilidade:** Catálogo dinâmico de capacidades e custos dos modelos (`schemas/hia-model.schema.json`), associando tarefas aos modelos que demonstraram qualidade no benchmark (F4).

### 2.6 Resource Governor & Execution Guard (`tools/lib/hia/guard.js`)
- **Responsabilidade:** Controle de fila, concorrência, retries e telemetria de consumo.
- **Detecção de Loops:** Se um agente repetir o mesmo padrão de ferramenta ou chamada consecutiva 3 vezes sem progresso de arquivos, a execução é interrompida (`loop_detected`).
- **Telemetria Canônica:** Gravação de cada `ExecutionRecord` em `projects/<slug>/coordination/events/` ou pasta de auditoria local, registrando tokens de entrada, saída, cache e tempo.

---

## 3. Matriz de Integração com Motores Existentes

| Motor Existente | Ponto de Integração | Mudança Proposta |
|---|---|---|
| **Claude Code** (`claude.js`) | `spawn(resolveClaudeBin())` | Manter CLI intacto; ativar filtragem de contexto prévio para evitar envio duplicado do repositório; mitigar fan-out excessivo de subagentes. |
| **Codex** (`codex.js`) | `spawn(resolveCodexBin())` | Preservar sessões `exec resume`; capturar o evento `token_count` no stream e registrá-lo na telemetria HIA. |
| **Gemini** (`gemini.js`) | `fetch(generativelanguage...)` | Eliminar fallback silencioso para `gemini-3-flash-preview`; retornar erro amigável quando 429/503 e permitir escolha consciente do usuário. |
| **OpenCode** (`opencode.js`) | `fetch(http://localhost:63186)` | Manter para tarefas assíncronas em segundo plano com modelos gratuitos (`-free`). |
| **Ollama Local** (Novo) | `fetch(http://localhost:11434)` | Adicionar como motor local de custo zero para classificação, extração de JSON e sumarização. |

---

## 4. Estratégia de Transição e Feature Flags

Para garantir risco zero de regressão:
1. Uma variável `HIA_ROUTING_ENABLED` (em `global/.env`) controlará a ativação do Intelligent Router.
2. Com `HIA_ROUTING_ENABLED=false` (padrão inicial), o fluxo de chat e execução funciona exatamente como hoje (seleção manual de motor na UI).
3. Cada ferramenta do Automation Registry funciona como uma chamada standalone e pode ser testada isoladamente via CLI `node tools/hia.js run <tool-id>`.
