# Épico 01 — Ollama Adapter

## Visão Geral
Implementação do cliente HTTP dedicado para comunicação com o daemon Ollama (`localhost:11434`), provendo:
- Health check e descoberta dinâmica de modelos locais instalados.
- Chamada não-streaming estruturada (`format: "json"`).
- Gestão de parâmetros (`temperature`, `num_ctx`, `num_predict`, `keep_alive`, `think=false`).
- Resiliência: timeouts curtos configuráveis, cancelamento por `AbortSignal` e proteção de memória RAM.

## Histórias de Usuário
- [01.01](01.01-http-client.md): Cliente HTTP base com resiliência, timeouts e suporte a JSON estruturado.
- [01.02](01.02-health-model-discovery.md): Health check e descoberta dinâmica de modelos instalados (`/api/tags`).
- [01.03](01.03-structured-inference.md): Endpoint de inferência síncrona não-streaming para classificação estruturada com telemetria nativa.
