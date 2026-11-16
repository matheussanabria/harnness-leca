---
domain: tools
module: coverage
feature: design-provider-services
summary: Server configuration and providers for design agents, frameworks, design systems and layers.
paths: [ui/server/services/design-agents.config.js, ui/server/services/design-system-provider.factory.js, ui/server/services/framework-adapter.factory.js, ui/server/services/layers-provider.factory.js]
keywords: [design, providers, framework, layers, agents]
updated: 2026-11-16
---
# Design Provider Services / Serviços Provedores de Design

| File | Responsibility |
|---|---|
| `ui/server/services/design-agents.config.js` | Maps design workflow stages to DAI agents and suggested next actions. / Mapeia etapas do fluxo de design para agentes DAI e próximas ações sugeridas. |
| `ui/server/services/design-system-provider.factory.js` | Creates the filesystem-backed Design System provider. / Cria o provedor de Design System baseado no sistema de arquivos. |
| `ui/server/services/framework-adapter.factory.js` | Creates adapters for Angular and static HTML prototypes. / Cria adaptadores para Angular e protótipos HTML estáticos. |
| `ui/server/services/layers-provider.factory.js` | Normalizes and sanitizes component tokens in layer documentation. / Normaliza e sanitiza tokens de componentes na documentação em camadas. |
