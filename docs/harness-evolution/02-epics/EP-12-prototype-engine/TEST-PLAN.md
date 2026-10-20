# Plano de Testes — EP-12

[Voltar ao EP-12](README.md)

Este documento define a suite de validacao para garantir que a extracao, inspecao e geracao multiframework ocorram sem perdas funcionais.

---

## 1. Niveis de Testes

| Nivel | Escopo | Ferramental |
|---|---|---|
| **Unitario** | Parsers de AST, validadores de schema JSON (`proto.json`, Registry), geradores de boilerplate | Node.js Test Runner (`node --test tests/...`) |
| **Integracao** | Protocolo de mensagens PostMessage, servico de catalogo, extrator semantico | Testes com mock de sandbox e snapshots |
| **E2E / Visual** | Renderizacao no Atelie e Studio, selecao de nos da arvore, edicao a quente | Browser tests / Playwright / Puppeteer |

---

## 2. Matriz de Verificacao dos Marcos (Milestones)

### Marco M1 (Extracao Confiavel)
- [ ] Teste unitario: Extrator recupera 100% dos seletores CSS necessarios para um componente isolado.
- [ ] Teste unitario: Script JS associado executa sem dependencias globais nao declaradas.
- [ ] Teste de isolamento: Renderizar `AnnotationList` isolado no preview sem erros de console.

### Marco M2 (Prototipo Inspecionavel)
- [ ] Teste de schema: Validacao do `proto.json` contra o JSON Schema v2.0.0.
- [ ] Teste de ponte: Envio de `SELECT_NODE` reflete o highlight exato no canvas do iframe.
- [ ] Teste de mutacao: Edicao de prop no painel altera o DOM do preview sem reload total.

### Marco M3 (Studio Multiframework)
- [ ] Teste de adaptadores: O mesmo no `PrototypeNode` gera codigo sintaticamente valido em Angular 18 e React 18.
- [ ] Teste de paridade: Propriedades repassadas refletem as mesmas classes e elementos emitidos nos frameworks.
