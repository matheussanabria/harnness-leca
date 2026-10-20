# Fase F7: Studio, Rastreabilidade e Piloto

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F7 conclui o EP-12 concretizando o Marco M3 (Studio Multiframework). Ela unifica o Atelie ao Studio sob a mesma engine, implementa rastreabilidade completa e valida todo o ecossistema com o piloto final do fluxo DIS Dispensacao.

---

## 2. Historias da Fase F7

### 12.29 — Integracao da arvore do motor ao Studio unificado
- **Objetivo:** Fazer o Studio consumir diretamente o Renderer e Inspetor do Prototype Engine na aba Design/Preview.
- **Entregaveis:** Studio atualizado operando sobre `proto.json`.

### 12.30 — Rastreabilidade end-to-end: Tela -> No -> Componente -> Codigo
- **Objetivo:** Permitir que clicar em qualquer elemento no preview do Studio abra diretamente o arquivo-fonte correspondente na aba Codigo.
- **Entregaveis:** Navegacao contextual bidirecional entre Canvas visual e Editor de codigo.

### 12.31 — Piloto completo do fluxo DIS Dispensacao de Medicamentos
- **Objetivo:** Executar o fluxo completo de dispensacao (pesquisa de paciente, selecao de lote, validacao de receita e confirmacao) no novo prototipo modular.
- **Entregaveis:** Homologacao de ponta a ponta do fluxo DIS sem quebras funcionais.

### 12.32 — Documentacao, kits de componentes e homologacao final
- **Objetivo:** Gerar a documentacao consolidada do Design System, registrar kits atualizados e homologar a transicao.
- **Entregaveis:** Relatorio final do EP-12 e kits disponibilizados aos agentes MCP.
