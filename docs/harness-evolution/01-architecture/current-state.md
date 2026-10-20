---
tags: [harness-evolution, arquitetura, estado-atual]
status: auditado
data: 2026-10-19
commit: 152b06f
---

# Estado atual (Auditado)

Consolidado a partir da auditoria técnica executada no [EP-00](../02-epics/EP-00-auditoria/README.md).

## 1. Pilha Tecnológica
- **Runtime:** Node.js v24.22.0 (>= 22.13), CommonJS no backend (`ui/server.js`), ES Modules nativos no navegador (`ui/public/js/`).
- **Sem dependências externas no runtime:** Não utiliza pacotes npm em produção.
- **Qualidade & Testes:** Suíte nativa `node:test` com **256 testes passando e 0 falhas** (`npm test`), 368 arquivos checados sem erro de sintaxe (`npm run check`). Checagem TypeScript (`npm run types`) possui 311 linhas de erro pré-existentes de tipagem estática que não impedem execução.
- **Interfaces:** Interface principal (`index.html`), Escritório Virtual (`office.html`), Deploy (`deploy.html`), Diário (`diario.html`), Visão Geral (`overview.html`).

## 2. Respostas às Perguntas Fundamentais da Auditoria

### 1. Qual componente abre e fecha o painel lateral de cada estação?
- **Abertura:** Todas as estações disparam `officeState.selectObject(key)` (`ui/public/js/office-state.js:162`), o que seta `isDrawerOpen = true`.
- **Renderização:** O container DOM único `#officeDrawer` (`ui/public/office.html`) recebe a classe `.open` e chama `renderDrawerContent` (`ui/public/js/office/office-drawer-views.js:10-110`).
- **Fechamento:** O botão `#drawerCloseBtn` chama `officeState.closeDrawer()` (`ui/public/js/office-app.js:110-112`).
- **Conclusão:** Existe **um único drawer lateral**, impedindo múltiplos painéis abertos simultaneamente. O Window Manager (EP-01) deve substituir/envelopar este mecanismo.

### 2. Como o foco do teclado é tratado entre input de texto e avatar?
- O avatar escuta eventos globais `keydown`/`keyup` em `ui/public/js/office3d/avatar-movement.js:24-25`.
- Há uma guarda que ignora movimento apenas se `document.activeElement.tagName` for `"input"` ou `"textarea"`.
- **Vulnerabilidade encontrada:** Elementos com `contenteditable="true"` não são verificados em `avatar-movement.js`, fazendo com que a digitação mova o avatar. O Window Manager deve fornecer bloqueio centralizado de entrada para a câmera/física.

### 3. Painéis do escritório reutilizam os módulos da interface principal ou têm cópias?
- **São cópias / implementações isoladas:**
  - O chat da mesa (`ui/public/js/office/office-desk-interaction.js`) envia requisições brutas via `fetch('/api/chat')`, ignorando o store universal, anexos, formatação rica e SSE do módulo `ui/public/js/modules/chat.js`.
  - As mensagens trocadas na mesa ficam apenas em nós DOM em memória e são perdidas ao fechar o drawer.
  - Deploy e Diário replicam HTML em vez de carregar os módulos ou iframes dos endpoints dedicados.

### 4. O que já é persistido no navegador (`localStorage`)?
- São 38 ocorrências mapeadas em `ui/public/js/` (ver [inventory.md](audit/inventory.md#5-persistência-no-navegador-localstorage--sessionstorage)).
- O estado de abertura do drawer e as conversas da mesa **não são persistidos**.
- Projetos salvam histórico de conversas em `chats/*.md` via `/api/chat/save`, mas a mesa do escritório não utiliza essa persistência.

### 5. Quais testes cobrem o escritório?
- O escritório 2D/3D **não possui cobertura de testes unitários automatizados** em `tests/*.test.js` (a suíte cobre servidor, chat universal, motores, scrum, protótipos e orquestração).
- A validação do escritório é prioritariamente E2E e visual. O baseline inicial foi registrado em [TP-00-baseline.md](../04-test-plans/TP-00-baseline.md).
