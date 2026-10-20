# Fase F6: Adaptadores Multiframework

[Voltar ao EP-12](../README.md)

## 1. Visao geral

A Fase F6 desenvolve os compiladores de saida semanticos que transformam o modelo do prototipo (`proto.json`) e seus componentes do Registry em codigo nativo e idiomatico para Vanilla, Angular e React.

---

## 2. Historias da Fase F6

### 12.25 — Adaptador de geracao Vanilla HTML/CSS/JS
- **Objetivo:** Emitir prototipos vanilla limpos sem dependencias de build, ideais para distribuicao estatica rapida.
- **Entregaveis:** Gerador `VanillaAdapter` e templates correspondentes.

### 12.26 — Adaptador Angular 18 (Signals, Standalone Components)
- **Objetivo:** Converter telas e componentes em arquitetura Angular 18 moderna (Standalone Components, Signals, inject()).
- **Entregaveis:** Gerador `AngularAdapter` com suporte a templates `@if`, `@for` e TypeScript estrito.

### 12.27 — Adaptador React 18+ (Hooks, Functional Components)
- **Objetivo:** Converter telas e componentes em aplicacoes React modernas com TypeScript e Tailwind/CSS Modules.
- **Entregaveis:** Gerador `ReactAdapter` com suporte a JSX e estado com hooks.

### 12.28 — Matriz de paridade e testes de fidelidade entre frameworks
- **Objetivo:** Validar que a mesma definicao semantica em `proto.json` produz telas com aparencia e comportamento equivalentes nos tres alvos.
- **Entregaveis:** Suite de testes visuais automatizados de paridade.
