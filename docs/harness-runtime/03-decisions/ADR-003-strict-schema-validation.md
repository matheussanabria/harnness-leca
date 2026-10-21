# ADR-003 — Validação Estrita de Contrato e Fallback Gracioso Local

## Status
Aprovado

## Contexto
Modelos locais menores (3B a 4B parâmetros) podem eventualmente gerar saídas fora do padrão esperado ou com campos nulos. O sistema precisa garantir integridade determinística antes de qualquer decisão baseada em saídas da LLM.

## Decisão
1. Exigir o modo `format: "json"` no Ollama.
2. Executar validação estrita de schema com validação síncrona dos tipos permitidos (`tipo`, `complexidade`, `modulo`, `executorSugerido`, `justificativa`).
3. Se a validação falhar:
   - A requisição é marcada como `validation_failed`.
   - Um registro de telemetria é gerado contendo o motivo da falha.
   - Nenhuma suposição heurística arriscada é adotada.
   - O classificador retorna um objeto de erro controlado.

## Consequências
- **Positivas:** Previsibilidade absoluta; isolamento total contra alucinações estruturais do modelo.
- **Negativas / Riscos:** Respostas ligeiramente divergentes do vocabulário controlado serão descartadas, forçando o refinamento do prompt do modelo local.
