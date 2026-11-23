---
domain: backend
module: core
feature: feature-manifest
summary: Feature manifest with scopes (project, optional, global), its validator and the GET /api/features route (EP-25.01).
paths: [ui/server/features/*.js, ui/server/controllers/features.controller.js, ui/server/routes/features.routes.js, tests/features-manifest.test.js, tests/features-route.test.js]
keywords: [features, manifest, scope, launcher, escopo, project, optional, global]
updated: 2026-11-23
---
# Feature manifest

| File | Responsibility |
|---|---|
| `ui/server/features/manifest.js` | List of user-navigable features with scope, icon, route, window and description; `estado: planejada` entries are listed as "Em breve"; throws at load if invalid; `availability` marks project-scope features unavailable without a project. |
| `ui/server/features/validate.js` | Pure validator: kebab-case ids, unique ids and routes, valid scope and estado, FontAwesome icons, no emoji in titles and descriptions. |
| `ui/server/controllers/features.controller.js` | `GET /api/features`: resolves the scope from the `X-Harness-Project` header (`resolveScope`, 404 for an unknown project) and returns the manifest with availability. |
| `ui/server/routes/features.routes.js` | Registers the route in the table. |
| `tests/features-manifest.test.js` | Validator rules, shipped manifest validity and availability. |
| `tests/features-route.test.js` | Route shape, header parsing and the two availability cases. |
