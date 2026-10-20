# Fase F4: Importacao e Reconstrucao

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F4 pega os documentos legados de fluxo completo (como `Main.dc.html` do DIS) e os decompõe de forma automatizada e confiavel para o formato moderno de prototipo (`proto.json`, `screens/`, `data/`, `styles/`).

---

## 2. Historias da Fase F4

### 12.17 — Pipeline de parsing semantico do DOM legado
- **Objetivo:** Analisar a casca HTML do legado, mapeando elementos DOM para componentes conhecidos do Registry.
- **Entregaveis:** Parser de migracao semantico com heuristicas de classes e tags.

### 12.18 — Decompositor de telas para `screens/*.html` estruturados
- **Objetivo:** Extrair cada tela/fluxo em um arquivo HTML limpo com anotacoes `data-node-id`.
- **Entregaveis:** Pasta `screens/` preenchida com as telas identificadas no monólito.

### 12.19 — Gerador de manifesto de prototipo `proto.json`
- **Objetivo:** Gerar o `proto.json` compativel com o schema v2.0.0 a partir das telas e nos extraidos.
- **Entregaveis:** Manifesto completo gerado automaticamente.

### 12.20 — Reconstrucao do prototipo DIS Paciente no novo formato
- **Objetivo:** Publicar o prototipo DIS no diretorio `projects/saude-dispensacao/design/prototypes/dis-modular/`.
- **Entregaveis:** Prototipo totalmente funcional e compativel com o novo motor.
