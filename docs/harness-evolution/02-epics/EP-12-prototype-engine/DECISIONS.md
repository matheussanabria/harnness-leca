# Decisoes Arquiteturais (ADRs) — EP-12

[Voltar ao EP-12](README.md)

Este documento registra as decisoes de design cruciais tomadas para o EP-12.

---

## ADR-012.01: Preservacao Imutavel dos HTMLs Monoliticos Legados

- **Status:** Aprovada
- **Contexto:** Os arquivos `dis-design-system.html` e `Main.dc.html` possuem mais de 1MB e contem estilos, comportamentos e telas acoplados. Qualquer edicao direta in-place nesses arquivos durante a construcao do motor pode corromper a referencia original.
- **Decisao:** Os arquivos originais serao mantidos 100% intactos e somente para leitura em seus locais de origem (`projects/<slug>/design/`). Todo processo de extracao e reconstrucao modular emitira novos artefatos organizados em pastas isoladas (`ds/`, `screens/`, `components/`), permitindo testes comparativos contínuos contra o baseline.

---

## ADR-012.02: Identidade Semantica Canônica dos Componentes

- **Status:** Aprovada
- **Contexto:** Cada framework (Vanilla, Angular, React) possui convencoes proprias de nomenclatura (ex: `dis-annotation-list`, `AnnotationListComponent`, `AnnotationList`). Se a identidade do componente for atrelada a uma linguagem, a unificacao no Studio se torna inviavel.
- **Decisao:** Todos os componentes recebem uma identidade canonica independente de linguagem no formato `<namespace>.<kebab-name>` (ex: `dis.annotation-list`). Adaptadores sao responsaveis por mapear essa identidade canonica para as convencoes idiomaticas de cada framework.

---

## ADR-012.03: Separacao Estrita entre Schema do Prototipo e Adaptadores

- **Status:** Aprovada
- **Contexto:** Muitas ferramentas convertem HTML legado diretamente para JSX ou templates Angular por regex ou AST semantica rasa, perdendo interatividade, validacao e capacidade de inspecao retroativa.
- **Decisao:** O `proto.json` funciona como Intermediate Representation (IR) semantica. O Inspetor e o Atelie manipulam exclusivamente o IR. Os geradores de codigo funcionam como compiladores *target-specific* (backend compilers) que leem o IR e produzem o codigo do framework escolhido.

---

## ADR-012.04: Isolamento de Preview via Sandbox Iframe e PostMessage Seguro

- **Status:** Aprovada
- **Contexto:** Estilos CSS de prototipos legados e modernos podem conflitar com a folha de estilos do Harness Leca / Studio caso sejam renderizados diretamente no DOM principal da aplicacao.
- **Decisao:** A renderizacao de telas de prototipos e componentes sempre ocorrera dentro de um `iframe` seguro com `sandbox="allow-scripts allow-same-origin"`. A comunicacao entre a barra de ferramentas do Atelie/Studio e o documento do preview sera mediada exclusivamente por eventos tipados via `postMessage`.
