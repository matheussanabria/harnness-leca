---
domain: tools
module: coverage
feature: memory-analysis
summary: Conversation analysis, memory suggestions, review, consolidation and journal CLIs.
paths: [tools/consolidate-memory.js, tools/daily-journal.js, tools/extract-artifacts.js, tools/extraction-state.js, tools/memory.js, tools/suggest-groups.js, tools/lib/classify.js, tools/lib/consolidate.js, tools/lib/extraction.js, tools/lib/memory-review.js, tools/lib/suggest.js, tools/lib/taxonomy.js]
keywords: [memory, extract, suggestions, review, consolidate, classify, journal, taxonomy]
updated: 2026-11-16
---
# Memory and conversation analysis

| File | Responsibility |
|---|---|
| `tools/consolidate-memory.js` | EN: CLI for grouping and prioritizing pending memory suggestions, with preview and undo. PT: CLI para agrupar e priorizar sugestões de memória pendentes, com prévia e desfazer. |
| `tools/daily-journal.js` | EN: Builds local daily activity summaries and a journal index from project chats. PT: Gera resumos diários locais de atividade e índice a partir das conversas. |
| `tools/extract-artifacts.js` | EN: Extracts rules, files, documents and optional model-generated memory suggestions from chats. PT: Extrai regras, arquivos, documentos e sugestões opcionais de memória geradas por modelo. |
| `tools/extraction-state.js` | EN: CLI to inspect, adopt, mark or reset analyzed-conversation state. PT: CLI para consultar, adotar, marcar ou redefinir o estado das conversas analisadas. |
| `tools/memory.js` | EN: CLI for declarative-memory indexing, migration, saving, harvesting and linting. PT: CLI de índice, migração, gravação, coleta e lint da memória declarativa. |
| `tools/suggest-groups.js` | EN: CLI for suggesting conversation groups from local activity signals. PT: CLI que sugere grupos de conversas a partir de sinais locais de atividade. |
| `tools/lib/classify.js` | EN: Assigns one or more taxonomy topics to a conversation using local heuristics. PT: Atribui temas da taxonomia a conversas usando heurísticas locais. |
| `tools/lib/consolidate.js` | EN: Groups duplicate memory suggestions and supports reversible consolidation. PT: Agrupa sugestões de memória repetidas e permite reverter a consolidação. |
| `tools/lib/extraction.js` | EN: Pure status and table-rendering rules for extraction progress. PT: Regras puras de status e renderização da tabela de progresso de extração. |
| `tools/lib/memory-review.js` | EN: Applies promote, edit and discard decisions to extracted memory suggestions. PT: Aplica decisões de promover, editar e descartar sugestões extraídas. |
| `tools/lib/suggest.js` | EN: Produces conversation group suggestions from classified activity, optionally checked by a model. PT: Sugere grupos a partir da atividade classificada, com confirmação opcional por modelo. |
| `tools/lib/taxonomy.js` | EN: Defines the topic tree and normalization used by conversation classification. PT: Define a árvore temática e a normalização usadas na classificação. |
