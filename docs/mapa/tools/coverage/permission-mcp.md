---
domain: tools
module: coverage
feature: permission-mcp
summary: MCP permission prompt and project-specific Claude runtime configuration.
paths: [tools/permission-mcp.js, tools/lib/permissions.js, tools/lib/project-mcp.js]
keywords: [permission, approval, MCP, Claude, project config]
updated: 2026-11-16
---
# Permission and project MCP

| File | Responsibility |
|---|---|
| `tools/permission-mcp.js` | EN: Stdio MCP tool that requests a permission decision from the Harness UI. PT: Ferramenta MCP por stdio que solicita ao Harness uma decisão de permissão. |
| `tools/lib/permissions.js` | EN: Tracks Claude permission requests and delivers UI decisions to the chat. PT: Controla pedidos de permissão do Claude e devolve decisões da interface ao chat. |
| `tools/lib/project-mcp.js` | EN: Loads project-specific repository, permission and MCP configuration for Claude. PT: Carrega configuração do projeto para repositório, permissões e MCPs do Claude. |
