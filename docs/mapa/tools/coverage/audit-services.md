---
domain: tools
module: coverage
feature: audit-services
summary: Audit matrix, evidence model/storage, test generation, execution and recording services.
paths: [ui/server/services/audit/audit-matrix.service.js, ui/server/services/audit/audit-pipeline.service.js, ui/server/services/audit/component-audit.service.js, ui/server/services/audit/evidence-detection.js, ui/server/services/audit/evidence-model.js, ui/server/services/audit/evidence-recorder.service.js, ui/server/services/audit/evidence-store.js, ui/server/services/audit/test-execution.service.js, ui/server/services/audit/test-generation.service.js]
keywords: [audit, evidence, tests, execution, rules]
updated: 2026-11-16
---
# Audit Services / Serviços de Auditoria

| File | Responsibility |
|---|---|
| `ui/server/services/audit/audit-matrix.service.js` | Builds audit matrix and legacy comparison summaries. / Monta a matriz de auditoria e resumos de comparação com legado. |
| `ui/server/services/audit/audit-pipeline.service.js` | Coordinates test evidence generation, execution and approval states. / Coordena estados de geração, execução e aprovação de evidências de teste. |
| `ui/server/services/audit/component-audit.service.js` | Cross-references the component board with audit rules. / Cruza o quadro de componentes com regras de auditoria. |
| `ui/server/services/audit/evidence-detection.js` | Finds real test artifacts in a project. / Localiza artefatos reais de teste no projeto. |
| `ui/server/services/audit/evidence-model.js` | Validates evidence kinds/states and computes effective test evidence. / Valida tipos/estados de evidência e calcula evidência efetiva de teste. |
| `ui/server/services/audit/evidence-recorder.service.js` | Lists and records project test evidence. / Lista e registra evidências de teste do projeto. |
| `ui/server/services/audit/evidence-store.js` | Reads/writes the per-project audit evidence manifest. / Lê e grava o manifesto de evidências de auditoria por projeto. |
| `ui/server/services/audit/test-execution.service.js` | Resolves and runs an authorized generated test artifact. / Resolve e executa um artefato de teste gerado autorizado. |
| `ui/server/services/audit/test-generation.service.js` | Generates test artifacts from an audit rule. / Gera artefatos de teste a partir de uma regra de auditoria. |
