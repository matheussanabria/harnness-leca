# Fase F3: Prototype Schema

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F3 formaliza o contrato `proto.json` e a estrutura de telas como a representacao semantica definitiva dos prototipos. O schema garante que navegacao, acoes, estado e hierarquia de componentes sejam persistidos sem depender de nenhum framework web especifico.

---

## 2. Historias da Fase F3

### 12.13 — Especificar schema semantico estendido do `proto.json`
- **Objetivo:** Definir a especificacao v2.0.0 com suporte a arvore indexada de `PrototypeNode`.
- **Entregaveis:** JSON Schema oficial e tipagens TypeScript em `CONTRACTS.md`.

### 12.14 — Modelar slots, eventos, bindings e navegacao de telas
- **Objetivo:** Permitir que nos contenham filhos em slots nomeados e definam transicoes de tela e mutacoes de estado.
- **Entregaveis:** Suporte a navegacao entre telas no manifesto do prototipo.

### 12.15 — Schema de estado e mocks de dados dinamicos
- **Objetivo:** Estruturar `initialState` e mocks em `data/*.json` para alimentar formularios e listas no prototipo.
- **Entregaveis:** Mecanismo de injecao de mock de dados no preview.

### 12.16 — Validador de schema com JSON Schema e testes
- **Objetivo:** Garantir que nenhum arquivo `proto.json` corrompido ou invalido seja persistido pelo Studio ou Atelie.
- **Entregaveis:** Validador em tempo de execucao (`validatePrototypeSchema()`) e testes automatizados.
