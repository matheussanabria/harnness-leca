# Fase F1: Design System Registry

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F1 estabelece o catalogo canonico e unificado de componentes do Design System. O Registry atua como a unica fonte de verdade de definicao de componentes (metadados, propriedades, slots, eventos e dependencias) para todos os agentes, Studio e Atelie.

---

## 2. Historias da Fase F1

### 12.05 — Definir manifesto e identidade dos componentes
- **Objetivo:** Estabelecer o esquema formal do `DesignSystemComponent` com namespace (ex: `dis.annotation-list`).
- **Entregaveis:** Validadores de manifesto e especificacao do catalogo em `design-system.json`.

### 12.06 — Evoluir extracao HTML, CSS e JavaScript
- **Objetivo:** Aprimorar o motor de extracao para decompor componentes dos monólitos legados com seletores e tokens semanticos associados.
- **Entregaveis:** Servico de extracao enriquecido gerando pacotes isolados.

### 12.07 — Registrar Angular, React e dependencias
- **Objetivo:** Mapear quais componentes possuem implementacoes disponiveis, geradas ou validadas em cada framework.
- **Entregaveis:** Campo `implementations` estruturado por componente no Registry.

### 12.08 — Criar API de consulta compartilhada
- **Objetivo:** Disponibilizar endpoints REST e MCP tools para consulta e resolucao de componentes por nome, categoria ou framework.
- **Entregaveis:** Rotas em `ui/server/router.js` (`/api/project/:slug/design/registry`) e controller dedicado.

---

## 3. Entregaveis Concluidos da F1

- **Servico do Registry:** [`ui/server/services/design-registry.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/design-registry.service.js)
- **Extrator Semantico & Piloto:** [`ui/server/services/design-extractor.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/design-extractor.service.js)
- **Controller REST:** [`ui/server/controllers/design-registry.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/design-registry.controller.js)
- **Componente Piloto Extraido:** [`projects/saude-dispensacao/design/ds/components/annotation-list/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/ds/components/annotation-list/)
- **Registro Persistido:** [`projects/saude-dispensacao/design/ds/registry.json`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/ds/registry.json)
- **Testes Automatizados:** [`tests/design-registry.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-registry.test.js) e [`tests/design-registry-routes.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-registry-routes.test.js)
