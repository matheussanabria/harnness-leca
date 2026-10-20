# Dados, migração, segurança e testes

## Migração proposta

1. Backup versionado de `scrum.json`.
2. `schemaVersion` e leitor compatível.
3. Proposta: `todo -> pronto-para-dev`, `in_progress -> em-desenvolvimento`, `review -> em-revisao`, `done -> concluido`; Produto deve confirmar.
4. Gerar board/lanes e histórico inicial de migração.
5. Comparar contagens, pontos, Sprint, épico e IDs.
6. Escrita atômica com temporário + rename.
7. Manter leitor antigo por uma versão.

Rollback: parar gravações, exportar eventos posteriores, restaurar backup e leitor antigo. Nenhuma migration foi executada.

## Segurança

Preservar origem/JSON, confinamento/`realpath`, redaction, permissões, sanitização e erros públicos limpos. Revisar autorização por projeto; limites/retenção de anexos; Markdown/HTML; prompt injection; segredos em eventos/logs/backups; aprovação sensível; remoção de `frame-ancestors` no preview; CSRF/replay e concorrência.

## Testes

- Unidade: schemas, comandos, transições, blockers, projeções, sanitização.
- Contrato: engines, SSE, eventos, APIs e versões.
- Integração: escrita atômica, migration/rollback, isolamento e permissões.
- UI DOM: menus, foco, teclado, composer e múltiplas instâncias.
- E2E: três layouts, Studio, Kanban e contexto entre módulos.
- Visual: Mapa/Studio nas seis larguras.
- Segurança: XSS, traversal, origem, upload, prompt injection e logs.

Gates: `npm run check`, `npm run types`, `npm test`. Adicionar cobertura só após decisão de dependências. Teste gerado permanece “não executado” até resultado verificável.

