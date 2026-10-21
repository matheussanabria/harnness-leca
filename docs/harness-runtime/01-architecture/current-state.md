# Auditoria do Estado Atual — Harness Runtime & Motores de IA

## 1. Inventário de Componentes Existentes

### 1.1 Motores (`tools/lib/engines/`)
- `index.js`: Fachada de acesso e registro dos motores (`claude`, `codex`, `gemini`, `opencode`, `ollama`).
- `ollama.js` (168 linhas): Implementação inicial para streaming (`/api/generate`) via fetch nativo, checagem de RAM (`hardware-profiler.js`) e consulta de tags (`/api/tags`).
  - *Lacuna atual:* Implementa apenas streaming para chat interativo. Não possui método estruturado (`json`), nem controle de `keep_alive`, `num_predict`, `num_ctx` ou `think=false`.
- `common.js`: Utilitários compartilhados (`PublicError`, normalização de modelos, injeção de contexto de projeto).
- `errors.js`: Tradução e sanitização de erros sem expor segredos nem caminhos absolutos.

### 1.2 Camada HIA & Roteamento (`tools/lib/hia/`)
- `hardware-profiler.js`: Inspeção de CPU e RAM (`safeForInference` com limite seguro de 3000 MB).
- `telemetry.js`: Append-only em `logs/telemetry/hia-executions.jsonl`.
- `router.js` & `registry.js`: Registro de automações e regras de roteamento (Fase F0-F7 do Harness Intelligence).

### 1.3 Controladores de Chat (`ui/server/controllers/chat.controller.js`)
- `apiChat`: Endpoint SSE (`/api/chat`) que recebe `{ engine, prompt, slug, ... }` e aciona o motor selecionado.
- *Diretriz de Segurança:* O modo Shadow NÃO deve interferir no fluxo síncrono nem atrasar as respostas do motor em uso pelo usuário.

## 2. Gaps e Limitações Identificados
1. **Falta de Cliente Não-Streaming Estruturado:** Falta um adapter robusto com validação JSON estrita para chamadas pontuais (classificação, extração).
2. **Pressão de Memória:** RAM atinge até 99% em picos com IDEs e múltiplos navegadores. O Ollama deve usar `keep_alive` curto ou sob demanda, com modelo ultraleve (`qwen3.5:4b` ou `qwen2.5-coder:1.5b`).
3. **Modo Shadow Passivo:** As classificações de intenção de tarefa devem rodar em segundo plano ou em interceptor desacoplado, sem bloquear o usuário e sem fallback de nuvem.
4. **Governança Modular:** Código deve respeitar estritamente o limite de 250-300 linhas por arquivo conforme `AGENTS.md`.
