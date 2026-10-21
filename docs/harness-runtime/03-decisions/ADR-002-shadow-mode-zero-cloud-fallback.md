# ADR-002 — Execução em Modo Shadow com Zero Fallback de Nuvem

## Status
Aprovado

## Contexto
Durante a Fase 1, o roteamento real das conversas do usuário deve continuar 100% inalterado (usando Claude, Codex, Gemini ou OpenCode conforme o usuário selecionar).
Precisamos validar em ambiente real a precisão, estabilidade e latência da classificação local sem interferir no fluxo do usuário nem introduzir regressões.

## Decisão
Implementar um interceptor em **Modo Shadow** (passivo):
1. O interceptor é acionado de forma não bloqueante a partir dos pontos de entrada de prompt (ex: `chat.controller.js`).
2. O resultado da classificação local é gravado exclusivamente na telemetria/logs para auditoria.
3. **Regra de Ouro (Zero Cloud Fallback):** Em caso de falha do Ollama (offline, timeout, payload corrompido ou memória baixa), a execução é abortada silenciosamente com status de erro nos logs de telemetria. Em hipótese alguma uma chamada para Claude, Gemini ou Codex será feita para compensar uma falha do classificador shadow.

## Consequências
- **Positivas:** Risco zero de regressão para o usuário final; nenhum gasto ou consumo acidental de cotas de IA em nuvem.
- **Negativas / Riscos:** Perda de registros de classificação quando o Ollama estiver offline, o que é aceitável para a fase de testes e telemetria.
