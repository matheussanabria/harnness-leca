# ADR-001 — Adoção do Ollama como Runtime Local Primário

## Status
Aprovado

## Contexto
O Harness Leca precisa realizar tarefas recorrentes de apoio (como classificação de intenções, categorização de histórico, roteamento e extração de metadados) sem consumir cotas pagas ou atingir limites de taxa dos motores de nuvem (Claude, Gemini, Codex).
O usuário dispõe de uma máquina Ryzen 5 7430U com 16 GB de RAM e GPU integrada, onde o Ollama já se encontra em operação servindo modelos como `qwen3.5:4b` e `qwen2.5-coder:1.5b`.

## Decisão
Adotar o daemon local do Ollama (`http://localhost:11434`) como motor local de inferência estruturada para a Fase 1.
- Comunicação via API REST nativa (`/api/generate` com `format: "json"` e `/api/tags`).
- Parâmetros conservadores de recursos: `temperature: 0.1`, `num_predict: 256`, `keep_alive: "5m"` e suporte a `think: false` para evitar consumo inútil de tokens de raciocínio em tarefas simples de categorização.

## Consequências
- **Positivas:** Custo zero de tokens, privacidade total, dados não saem da máquina, latência reduzida para poucas centenas de milissegundos após o warm-up.
- **Negativas / Riscos:** Consumo de RAM local (~2.5 a 3.5 GB com o modelo carregado). Mitigado com verificação prévia de memória via `hardware-profiler.js` e `keep_alive` controlado.
