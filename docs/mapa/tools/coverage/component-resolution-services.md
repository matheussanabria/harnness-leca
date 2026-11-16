---
domain: tools
module: coverage
feature: component-resolution-services
summary: Server editing and Angular component source resolution utilities.
paths: [ui/server/services/component-editor.service.js, ui/server/services/component-resolver-parse.js, ui/server/services/component-resolver-resolve.js, ui/server/services/component-resolver-store.js, ui/server/services/component-resolver-utils.js]
keywords: [components, angular, editor, resolver, source]
updated: 2026-11-16
---
# Component Resolution Services / Serviços de Resolução de Componentes

| File | Responsibility |
|---|---|
| `ui/server/services/component-editor.service.js` | Sanitizes editable component content and creates source fingerprints. / Sanitiza conteúdo editável de componentes e cria fingerprints da fonte. |
| `ui/server/services/component-resolver-parse.js` | Extracts Angular component metadata from TypeScript source. / Extrai metadados de componentes Angular de fontes TypeScript. |
| `ui/server/services/component-resolver-resolve.js` | Resolves and lists component files within a repository. / Resolve e lista arquivos de componentes dentro de um repositório. |
| `ui/server/services/component-resolver-store.js` | Defines shared ignored/forbidden directory and file size limits. / Define diretórios ignorados/proibidos compartilhados e limites de tamanho. |
| `ui/server/services/component-resolver-utils.js` | Provides path, TypeScript file search and name normalization helpers. / Fornece auxiliares de caminho, busca de TypeScript e normalização de nomes. |
