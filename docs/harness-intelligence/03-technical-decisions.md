# 03 - Decisões Técnicas e ADRs (F1)

**Status:** Aprovado para F1 | **Data:** 2026-10-19 | **Iniciativa:** Harness Intelligence & Automation

---

## ADR-HIA-001: Contratos Canônicos em JSON Schema (Draft-07)

### Contexto
Para conectar ferramentas determinísticas, modelos locais e motores de nuvem sem acoplamento rígido, é necessário padronizar o ciclo de vida das tarefas e as interfaces de entrada/saída.

### Decisão
Definir quatro schemas formais em `schemas/`:
1. `schemas/hia-task.schema.json`: Declara a intenção, escopo de contexto, prioridade e diretrizes de roteamento.
2. `schemas/hia-execution.schema.json`: Registra o executor real, tempos, métricas de tokens (reportadas ou estimadas), picos de hardware e evidência de conclusão.
3. `schemas/hia-tool.schema.json`: Contrato estrito para o Automation Registry (scripts determinísticos), com permissões e timeouts.
4. `schemas/hia-model.schema.json`: Contrato do Model Registry (capacidades, requisitos de RAM/CPU e tiers de custo).

### Consequências
- Toda nova ferramenta ou modelo adicionado deve respeitar esses schemas.
- Validação rápida em tempo de execução sem dependências pesadas externas.

---

## ADR-HIA-002: Mitigação e Governança do Fan-Out de Subagentes

### Contexto
A auditoria da F0 comprovou que **~69% das chamadas do Claude Code (2.234 de 3.236)** nos últimos 14 dias foram geradas por subagentes em processos paralelos. O disparo irrestrito de subagentes para tarefas simples consome rapidamente as cotas semanais do plano Claude.

### Decisão
1. **Regra de Agente Único para Diagnóstico e Planejamento:** F0 e F1 devem ser conduzidas por um único orquestrador principal sem disparar subagentes duplicados para ler o repositório.
2. **Triagem Prévia de Complexidade:** Se uma tarefa puder ser resolvida por inspeção de arquivo local ou script determinístico, proibir a instanciação de subagentes.
3. **Escopo Mínimo de Subagente:** Quando um subagente for estritamente necessário (ex: refatoração pontual de um módulo isolado), fornecer somente o caminho do arquivo alvo, sem injetar o `MAPA.md` completo ou históricos anteriores irrelevantes.

### Consequências
- Redução imediata de chamadas redundantes sem perda de rigor técnico.
- Fim da multiplicação de tokens por múltiplos agentes analisando o mesmo repositório simultaneamente.

---

## ADR-HIA-003: Política Explícita de Fallback e Transparência de Cotas

### Contexto
No código atual de `tools/lib/engines/gemini.js:67-70`, ao receber HTTP 503 (sobrecarga) ou HTTP 429 (cota de modelo Pro atingida), o sistema realiza um fallback silencioso e transparente para `gemini-3-flash-preview`.
Isso viola a Diretriz 11 do plano mestre ("Não utilizar modelos de nuvem automaticamente como fallback sem respeitar a política de autorização e orçamento") e esconde do usuário uma degradação de capacidade cognitiva.

### Decisão
1. **Eliminar Fallback Silencioso:** Nenhuma troca automática e oculta de modelo será permitida nos adaptadores.
2. **Notificação Acionável na UI/SSE:** Quando um modelo retornar 429 ou 503, o stream SSE devolverá um evento estruturado de erro (mapeado via `errors.js`), informando que a cota foi atingida e oferecendo ao usuário botões explícitos:
   - "Tentar com Flash Preview (Gratuito / Rápido)"
   - "Alternar para OpenCode Local / Modelo Gratuito"
   - "Aguardar renovação da janela"
3. **Respeito às Contas Pagas:** Modelos que cobram por token (OpenRouter, modelos não-free) nunca serão chamados automaticamente sem confirmação.

### Consequências
- Transparência total para o desenvolvedor sobre qual motor e modelo estão gerando cada resposta.
- Conformidade estrita com as políticas de orçamento e governança.

---

## ADR-HIA-004: Adoção do Runtime Local Ollama Nativo para Windows

### Contexto
A auditoria da F0 constatou que o ambiente da máquina host (AMD Ryzen 5 7430U, 14,8 GB RAM utilizável) **não possui Docker nem WSL2 instalados**, e a virtualização por hypervisor está desativada no Windows. Instalar WSL2 ou Docker exigiria alterações profundas no sistema operacional e privilégios elevados.

### Decisão
Adotar o **Ollama para Windows nativo** (`ollama.exe`), que roda diretamente sobre o subsistema Win32 sem necessidade de WSL2 ou contêineres Docker.

### Configuração Inicial para Benchmark (F4)
- Executável: `ollama.exe` instalado no perfil do usuário (`AppData\Local\Programs\Ollama` ou PATH padrão).
- Concorrência máxima: 1 inferência por vez.
- Limite de threads de CPU: 4 threads durante horário de trabalho interativo; até 6 threads em rotinas noturnas/batch.
- Modelos prioritários para teste: `qwen2.5-coder:1.5b`, `qwen2.5-coder:3b` e `qwen3:0.6b` (ou alternativas GGUF Q4 equivalentes com consumo < 3 GB RAM).

### Consequências
- Viabilização imediata da IA local sem modificar o sistema operacional com WSL2/Hyper-V.
- Isolamento de recursos para preservar a fluidez da IDE e do navegador.
