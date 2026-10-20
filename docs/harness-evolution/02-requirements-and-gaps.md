# Requisitos e matriz de lacunas

| Área | Estado | Problema → evidência → causa | Solução | Impacto / risco | Validação |
|---|---|---|---|---|---|
| Chat core | Parcial | Core é comum, mas `chat-ui-interaction.js` tem handlers `toggle*` e `toggleStudio*`; contrato orientado a IDs | Adapter de layout e comandos únicos | Alto / menus | Mesmos testes em 3 layouts |
| Estado do chat | Parcial | Conversa em `state.js`, sessões/config em `chat-store.js`; evolução dividida | `ChatSessionState` único com adapter legado | Alto / retomada | Alternar layouts sem perder turnos |
| Menus | Parcial | z-index varia de 5 a 99999; pilhas independentes | Primitive de popover, portal e camadas nomeadas | Médio / sobreposição | Teclado, clique externo, 375–1920 |
| Studio | Parcial | Resizer só mouse e limites 300/850 em `studio-core.js` | Pointer Events, teclado e tokens | Alto / acessibilidade | Mouse, toque, teclado, preview estável |
| Miniwidget | Parcial | Mesma store, CSS próprio com 304 linhas | Adapter `floating`; dividir CSS | Médio | Duas conversas e dialogs |
| Kanban | Ausente para alvo | `sanitizeStory` e `updateStoryStatus` reduzem a 4 status | Board/lane/transition/history/blocker versionados | Alto / migração | Golden tests e rollback |
| Backlog | Parcial | Mesmo modelo, sem versão/concorrência/trilha | Comandos atômicos com revisão | Alto / sobrescrita | Conflito simultâneo |
| Mapa | Parcial | Seis abas e responsividade existem; CSS tem 1437 linhas | Tokens e CSS por região | Médio / visual | Baselines exigidos |
| Fidelidade | Não verificável | Capturas não anexadas | Obter fonte, resolução e escala | Alto | Comparação lado a lado |
| Componentes | Parcial | Checklist de marcos, mas UI deriva `stage` única | Marcos independentes; etapa derivada | Médio | Múltiplos marcos simultâneos |
| Auditoria | Parcial | Métricas existem, sem semântica completa de execução | `TestEvidence` tipado | Alto / falso positivo | Gerado nunca é aprovado |
| Agentes | Parcial | Eventos/adapters existem; vínculo por raia não localizado | `LaneAutomationPolicy` versionada | Alto / execução indevida | Idempotência e aprovação |
| Segurança | Parcial | Origem, paths, redaction, permissões e sanitização existem; proxy altera CSP | Threat model por superfície | Alto | XSS, traversal, CSRF e logs |

## Atual versus esperado

- O chat já é parcialmente unificado: completar core/UI/layout/context, não criar outro.
- O Studio já tem resizer/mobile: faltam abstração, toque/teclado e matriz responsiva.
- O Scrum atual é quadro de quatro colunas, não workflow de doze raias.
- Componentes já têm checklist; preservá-lo evita marcos mutuamente exclusivos.
- Auditoria calcula indicadores, mas precisa guardar evidência de execução.
- Orquestração tem base de eventos; integrar por contrato, sem UI chamando CLI diretamente.

