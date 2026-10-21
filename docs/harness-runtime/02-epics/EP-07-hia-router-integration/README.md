# Épico 07 — Integração do HIA Router com o Runtime Local

## Visão Geral
O roteador HIA passa a reconhecer intenções de classificação e extração e a delegá-las ao runtime local quando o hardware é viável, preservando a cota de IA em nuvem.

## Histórias de Usuário
- [07.01](07.01-router-runtime-bridge.md): Ponte entre HIA Router e Local Runtime para roteamento Local-First.

## Evidências de Implementação
- `tools/lib/hia/router.js` — camada 2 (Local-First) ampliada para extração.
- `tools/lib/runtime/extractor.js` — destino da delegação.
- `tests/runtime-fase2.test.js` — caso "HIA Router delega extração estruturada para Local-First".
