---
domain: tools
module: coverage
feature: atelier-services
summary: Server services for Atelier agent loops, tools, scratchpads and chat-engine turns.
paths: [ui/server/services/atelier-agent-loop.service.js, ui/server/services/atelier-cli-engine-turn.service.js, ui/server/services/atelier-scratchpad.service.js, ui/server/services/atelier-tool-instruction.service.js, ui/server/services/atelier-tools.service.js]
keywords: [atelier, agent-loop, tools, scratchpad]
updated: 2026-11-16
---
# Atelier Services / Serviços do Atelier

| File | Responsibility |
|---|---|
| `ui/server/services/atelier-agent-loop.service.js` | Coordinates model turns and tool dispatch for the Atelier agent loop. / Coordena turnos do modelo e despacho de ferramentas no loop do agente do Atelier. |
| `ui/server/services/atelier-cli-engine-turn.service.js` | Runs a read-only chat-engine turn and parses tool tags for Atelier. / Executa um turno somente leitura do motor e interpreta tags de ferramenta. |
| `ui/server/services/atelier-scratchpad.service.js` | Manages isolated temporary prototype scratchpad files. / Gerencia arquivos temporários e isolados de rascunho do protótipo. |
| `ui/server/services/atelier-tool-instruction.service.js` | Supplies tool-use instructions for engines without native tool calling. / Fornece instruções de ferramentas para motores sem tool use nativo. |
| `ui/server/services/atelier-tools.service.js` | Defines atomic Atelier tool catalog and schemas. / Define o catálogo e schemas de ferramentas atômicas do Atelier. |
