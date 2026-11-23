---
domain: design
module: system
feature: global-ds
summary: Global Design System "codificadores" (50 cn.* components, shared tokens) and how projects inherit it.
paths: [global/design/ds/**, global/design/design-systems/codificadores.json, global/design/design-systems/codificadores.md, global/design/defaults.json, ui/server/services/design-profile-resolver.service.js, ui/server/services/design-registry.service.js, ui/server/services/design-registry-index.service.js, ui/server/services/design-system-provider.factory.js, ui/server/controllers/design-registry.controller.js, tests/design-registry-global.test.js]
keywords: [design system, global, codificadores, tokens, cn, inherit, baseTokensCss, registry, components]
updated: 2026-11-23
---
# Global Design System (codificadores)

The default Design System of every project: the same 50 components that were born in the 57Multimarcas project, with the `m57` namespace turned into `cn`. Components are global, tokens are per brand: no component carries a brand colour, so a project gets its own look by redefining tokens, not by copying the DS. The rule and the three layers (defaults, named DS, project profile) are in `global/design/design-systems/codificadores.md`.

| File | Responsibility |
|---|---|
| `global/design/ds/` | The DS itself: `tokens.css`, `components.css`, `registry.json`, `ds-index.md` and `components/<name>/` (HTML, CSS, JS, Angular, React and `manifest.json` for each of the 50 components). |
| `global/design/design-systems/codificadores.json` | Named DS descriptor (provider, paths, framework, stages) referenced as `designSystem.ref`. |
| `global/design/defaults.json` | `designSystem.ref: "codificadores"` makes it the default of every project. |
| `ui/server/services/design-profile-resolver.service.js` | Merges defaults, named DS and project profile; reports `designSystemRef`, `designSystemOrigin` and, when a project overrides the tokens, `baseTokensCss` (the DS tokens stay as the base). |
| `ui/server/services/design-registry.service.js` | Registry that sees the global DS and the project's own components. |
| `ui/server/services/design-registry-index.service.js` | Index of the components of both. |
| `ui/server/services/design-system-provider.factory.js` | Provider that loads `baseTokensCss` first and the project's tokens over it. |
| `ui/server/controllers/design-registry.controller.js` | Component preview: redirects to the inspection prototype only when it exists in the project, otherwise the isolated preview. |
| `tests/design-registry-global.test.js` | Inheritance, origin, token override with base, provider layering. |
