# Fase F5: Renderer e Inspetor

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F5 implementa o motor visual de renderizacao em sandbox segura e o inspetor de camadas bidirecional compartilhado entre Atelie e Studio, concretizando o Marco M2 (Prototipo Inspecionavel).

---

## 2. Historias da Fase F5

### 12.21 — Engine de renderizacao em sandbox iframe segura
- **Objetivo:** Renderizar telas estruturadas dentro de um iframe com isolamento de contexto e carregamento dinamico de estilos e scripts do prototipo.
- **Entregaveis:** Componente visual `PrototypeRenderer` com controle de resolucoes responsivas.

### 12.22 — Ponte de comunicacao bidirecional (PostMessage / EventBus)
- **Objetivo:** Estabelecer o canal seguro de troca de mensagens entre o host (Harness) e o preview sandbox.
- **Entregaveis:** Modulo `prototype-sandbox-bridge.js` com protocolo tipado.

### 12.23 — Inspetor de arvore com selecao bidirecional tela <-> arvore
- **Objetivo:** Ao clicar em um elemento visual no canvas, a arvore seleciona o no correspondente; ao clicar na arvore, o elemento e destacado no canvas.
- **Entregaveis:** Painel de camadas integrado com highlight e badges de componentes.

### 12.24 — Painel de propriedades e mutacao nao destrutiva do `proto.json`
- **Objetivo:** Permitir editar propriedades de um componente no painel lateral e refletir a alteracao a quente sem recarregar a tela.
- **Entregaveis:** Painel de propriedades dinamico com persistencia incremental.
