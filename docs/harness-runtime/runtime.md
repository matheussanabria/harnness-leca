# Implementação — Harness Leca Local AI Runtime (Fase 1)

## Objetivo

Integrar o Ollama ao Harness Leca como runtime local de IA, inicialmente para classificação e extração estruturada, sem alterar o roteamento de Claude, Codex, Gemini ou OpenCode.

## Contexto

- Runtime local: Ollama.
- Modelo inicial: `qwen3.5:4b`.
- Hardware: Ryzen 5 7430U, 16 GB RAM, GPU integrada.
- Benchmark: 48/50 acertos em tarefas de classificação, extração, localização e roteamento.
- Problema identificado: pressão de memória próxima de 99% com múltiplas aplicações abertas.
- Prioridade: reutilizar componentes existentes, evitar duplicação e minimizar tokens.

## Instruções obrigatórias

1. Ler `AGENTS.md`, `MAPA.md` e os contratos relevantes antes de modificar código.
2. Auditar `tools/lib/engines/`, `ui/server/controllers/chat.controller.js` e os módulos existentes de execução e telemetria.
3. Reutilizar os padrões existentes de engines, streaming, tratamento de erros e testes.
4. Não implementar um segundo orquestrador.
5. Não alterar o comportamento dos quatro motores atuais.
6. Atualizar o `MAPA.md` quando forem adicionados arquivos.

## Entregas

### 1. Ollama Adapter

Implementar um cliente HTTP para `localhost:11434`, com:

- Health check e detecção de modelos disponíveis.
- Inferência não streaming para tarefas estruturadas.
- Configuração de `temperature`, `num_ctx`, `num_predict` e `keep_alive`.
- Suporte a `think=false`, quando compatível.
- Timeout, cancelamento e tratamento de indisponibilidade.
- Captura das métricas retornadas pelo Ollama.
- Endpoint local configurável, restrito a destinos autorizados.

### 2. Task Classifier

Criar um serviço que receba uma solicitação e retorne:

```json
{
  "tipo": "bug",
  "complexidade": "baixa",
  "modulo": "diario",
  "executorSugerido": "local_llm",
  "justificativa": "Correção de comportamento existente"
}
```

Exigir validação estrita do contrato. Tratar respostas inválidas, ambiguidades e indisponibilidade do modelo.

O executor sugerido não deve executar ações automaticamente.

### 3. Modo Shadow

Registrar classificações e sugestões de roteamento sem alterar a execução real.

Nenhuma chamada de nuvem deve ser disparada como fallback automático.

### 4. Telemetria

Registrar por inferência:

- Modelo e versão.
- Tempo total, carregamento, processamento do prompt e geração.
- Tokens de entrada e saída.
- Resultado da validação.
- Erros e timeouts.
- Identificador de correlação.

Evitar persistir prompts, segredos ou dados pessoais nos logs.

### 5. Testes

Criar testes unitários e de integração com mocks, incluindo:

- Ollama disponível e indisponível.
- Resposta válida e inválida.
- Timeout e cancelamento.
- Modelo inexistente.
- Falha de validação de schema.
- Compatibilidade com os motores existentes.

Executar `npm test` e `npm run check`.

## Critérios de aceite

- Ollama integrado sem regressões.
- Classificação funcional e validada.
- Nenhuma execução automática baseada somente na saída da LLM.
- Nenhum consumo involuntário de provedores de nuvem.
- Métricas disponíveis para os próximos benchmarks.
- Documentação e `MAPA.md` atualizados.

## Entrega final do agente

Apresentar arquivos alterados, decisões arquiteturais, testes executados, resultados e pendências. Não iniciar a fase seguinte sem aprovação.