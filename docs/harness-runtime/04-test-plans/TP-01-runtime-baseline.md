# Plano de Testes — Baseline do Runtime Local (TP-01)

## 1. Escopo
Validação da integridade funcional, tratamento de erros e resiliência do Local AI Runtime (Ollama Adapter, Task Classifier, Shadow Interceptor e Telemetria).

## 2. Matriz de Casos de Teste

| ID | Componente | Cenário | Entrada | Resultado Esperado |
|---|---|---|---|---|
| **TC-01** | `ollama-client` | Health check online | Mock HTTP 200 `/api/tags` | `{ ok: true }` |
| **TC-02** | `ollama-client` | Daemon offline | Fetch rejeitado com erro de rede | `{ ok: false }` sem lançar unhandled rejection |
| **TC-03** | `ollama-client` | URL não autorizada | URL externa (ex: `http://api.externa.com`) | Lançar erro de segurança antes do fetch |
| **TC-04** | `schema` | Payload válido | JSON com todos os enums corretos | `{ valid: true }` |
| **TC-05** | `schema` | Enum inválido | `{ tipo: "desconhecido" }` | `{ valid: false, errors: [...] }` |
| **TC-06** | `classifier` | Classificação com sucesso | Prompt de correção de bug | Objeto estruturado com métricas e tipo "bug" |
| **TC-07** | `shadow` | Falha do Ollama | Daemon offline | Interceptor captura silenciosamente e registra erro |
| **TC-08** | `telemetry` | Sanitização | Prompt com código ou dados | Registra apenas metadados e contagens, nunca o prompt cru |
