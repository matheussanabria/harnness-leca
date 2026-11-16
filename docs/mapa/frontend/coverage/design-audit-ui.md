---
domain: frontend
module: coverage
feature: design-audit-ui
summary: Audit workspace UI sections, evidence API, matrix, component panel and shared state.
paths: [ui/public/js/modules/design-audit-components.js, ui/public/js/modules/design-audit-evidence-api.js, ui/public/js/modules/design-audit-evidence.js, ui/public/js/modules/design-audit-legacy.js, ui/public/js/modules/design-audit-matrix.js, ui/public/js/modules/design-audit-store.js, ui/public/js/modules/design-audit-workspace.js, ui/public/js/modules/design-audit.js]
keywords: [design, audit, evidence, matrix, workspace]
updated: 2026-11-16
---
# Design Audit UI / Interface de Auditoria de Design

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-audit-components.js` | Renders component-to-audit coverage in the audit tab. / Renderiza o cruzamento de componentes e auditoria. |
| `ui/public/js/modules/design-audit-evidence-api.js` | Reads the evidence-backed audit matrix from the server. / Lê do servidor a matriz de auditoria com evidências. |
| `ui/public/js/modules/design-audit-evidence.js` | Renders test evidence and legacy comparison rows. / Renderiza evidências de teste e comparação com legado. |
| `ui/public/js/modules/design-audit-legacy.js` | Renders legacy parity audit and action plan. / Renderiza auditoria de paridade com legado e plano de ação. |
| `ui/public/js/modules/design-audit-matrix.js` | Renders audit summary scorecards and rule matrix. / Renderiza scorecards de resumo e matriz de regras. |
| `ui/public/js/modules/design-audit-store.js` | Holds shared mutable audit screen state. / Mantém o estado mutável compartilhado da tela de auditoria. |
| `ui/public/js/modules/design-audit-workspace.js` | Renders the audit workspace and registers its handlers. / Renderiza o espaço de auditoria e registra seus handlers. |
| `ui/public/js/modules/design-audit.js` | Public audit facade and persisted screen state adaptation. / Fachada pública de auditoria e adaptação ao estado persistido da tela. |
