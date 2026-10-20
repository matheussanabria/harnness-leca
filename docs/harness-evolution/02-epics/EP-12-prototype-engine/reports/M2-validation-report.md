# Relatório de Homologação: Marco M2 — Protótipo Inspecionável

## Sumário Executivo
- **Data de Homologação**: 19/10/2026
- **Épico**: EP-12 — Prototype Engine & Design System Multiframework
- **Fase**: F5 — Renderer, Inspetor e Marco M2 (Protótipo Inspecionável)
- **Status Geral**: **APROVADO COM SUCESSO** (67/67 testes automatizados em 680ms)

---

## 1. Escopo e Critérios de Homologação do Marco M2

| Item | Critério de Aceite | Resultado | Evidência Técnica |
| :--- | :--- | :---: | :--- |
| **M2.1** | Renderização segura de protótipo em sandbox iframe com CSP restritivo | **Aprovado** | `ui/server/services/prototype-sandbox-renderer.service.js` aplica CSP com nonces criptográficos e tokens do DS. |
| **M2.2** | Suporte canônico a `data-node-id` com retrocompatibilidade total a `data-pid` | **Aprovado** | `prototype-bridge.js` e seletores CSS suportam identificadores semânticos v2 e v1 simultaneamente. |
| **M2.3** | Sincronização bidirecional entre canvas do iframe e árvore de camadas | **Aprovado** | `prototype-layer-tree.js` expande ancestrais, foca nós e dispara comandos `postMessage` tipados. |
| **M2.4** | Mutações não destrutivas em tela HTML e no schema `proto.json` | **Aprovado** | `mutateHtmlByPid` com `(?:data-node-id\|data-pid)` e `mutateNodeProps` com validação estrita de schema. |
| **M2.5** | Conformidade com regras arquiteturais (anti-monólito e anti-emojis) | **Aprovado** | Todos os arquivos abaixo de 250 linhas, ícones exclusivamente FontAwesome. |

---

## 2. Detalhamento dos Componentes Entregues

### 2.1. Engine de Renderização em Sandbox (`prototype-sandbox-renderer.service.js`)
- Renderização isolada no iframe com `default-src 'none'`, estilos controlados, nonces randômicos e injeção dos tokens `tokens.css` e `theme.css`.
- Mapeamento transparente de telas a partir do manifesto `proto.json` com fallback para `home.html`.

### 2.2. Ponte de Comunicação Bidirecional (`prototype-bridge.js`)
- Handshake `HARNESS_PROTO_READY` e emissão da árvore estruturada `HARNESS_PROTO_TREE`.
- Interceptação de seleções visuais (`HARNESS_PROTO_SELECT`), links de navegação (`[data-action="goto:..."]`) e escuta de ações do Host (`SELECT_BY_ID`, `HIGHLIGHT`, `TOGGLE_VISIBILITY`).

### 2.3. Árvore de Camadas Inspecionável (`prototype-layer-tree.js`)
- Navegação em árvore de componentes com categorias de ícones FontAwesome (`nav`, `action`, `form`, `table`, `component`, etc.).
- Filtro de busca textual em tempo real e visualização de profundidade semojis.

### 2.4. Mutação Semântica e Validação (`prototype-schema.service.js` e `prototype-editor.service.js`)
- Mutações de texto, classes e atributos de nós semânticos diretamente no HTML da tela.
- Atualização em memória e manifesto de `props` de nós semânticos sem violar o Draft-07 de `prototype-v2.schema.json`.

---

## 3. Matriz de Testes Automatizados

A suíte executada em `tests/marco-m2-validation.test.js` e `tests/prototype-*.test.js` registrou 100% de sucesso:
- `M2.1 - Sandbox Renderer compila protótipo modular com CSP e isolamento` (Passou)
- `M2.2 - Ponte e estilos suportam identificadores canônicos v2` (Passou)
- `M2.3 - Mutação de HTML na tela usando identificador canônico data-node-id` (Passou)
- `M2.4 - Mutação não destrutiva de props no proto.json preservando validação de schema` (Passou)

O **Marco M2 (Protótipo Inspecionável)** está formalmente homologado e pronto para a **Fase F6 — Geradores de Código Multiframework (Vanilla, Angular 18 e React 18+)**.
