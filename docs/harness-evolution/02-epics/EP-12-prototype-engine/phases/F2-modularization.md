# Fase F2: Modularizacao dos Boilerplates

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F2 transforma os componentes extraidos dos monólitos legados em boilerplates vanilla limpos, autocontidos e testaveis de forma isolada, estabelecendo a base para o Marco M1 (Extracao Confiavel).

---

## 2. Historias da Fase F2

### 12.09 — Isolar CSS global, temas e tokens semanticos
- **Objetivo:** Separar o CSS reset, variaveis CSS de tema e estilos compartilhados em folhas modulares.
- **Entregaveis:** `ds/tokens.css`, `ds/theme.css` e tokens semanticos mapeados.

### 12.10 — Fracionar componentes em boilerplates vanilla independentes
- **Objetivo:** Cada componente do Registry ganha uma pasta propria com HTML, CSS e JS especificos.
- **Entregaveis:** Estrutura `ds/components/<component-name>/` com arquivos focados (< 300 linhas).

### 12.11 — Criar harness de renderizacao isolada por componente
- **Objetivo:** Ambiente leve para carregar um componente unico com suas propriedades padrao em um iframe sandbox.
- **Entregaveis:** Ferramenta de teste visual de componente isolado.

### 12.12 — Validar suite de componentes vanilla com automacao
- **Objetivo:** Testar e homologar os primeiros 10 componentes principais (incluindo `AnnotationList`).
- **Entregaveis:** Relatorio de conformidade e testes unitarios passando.
