---
domain: tools
module: vault
feature: vault-knowledge
summary: Read-only keyword lookup into an external Obsidian knowledge vault (spike); prints paths and token cost.
paths: [tools/vault-knowledge.js, tools/lib/vault/*.js, tests/vault-knowledge.test.js]
keywords: [obsidian, vault, cerebro-digital, knowledge, conhecimento, find, stats, onedrive]
updated: 2026-11-09
---
# Vault knowledge lookup (spike)

Vault path comes from `--vault` or `HARNESS_VAULT`; default scope is `Conhecimento/` (`--sub a,b` to change).

| File | Responsibility |
|---|---|
| `tools/vault-knowledge.js` | CLI: `find <keywords> [--limit n]` prints note path, estimated tokens and area/domain/theme; `stats` sizes the vault. |
| `tools/lib/vault/scan.js` | Walks the vault (follows symlinks, skips `06 - Skills`, `16 - Clientes`, `Bancos de dados`, `.obsidian`), parses frontmatter, flags template skeletons as stubs, counts unreadable OneDrive online-only files. |
| `tools/lib/vault/query.js` | Accent-insensitive ranking (title 5, tags and classification 3, path 2), token estimate (bytes / 4), vault stats. |
| `tests/vault-knowledge.test.js` | Frontmatter parsing, folder exclusion, stub detection and ranking. |
