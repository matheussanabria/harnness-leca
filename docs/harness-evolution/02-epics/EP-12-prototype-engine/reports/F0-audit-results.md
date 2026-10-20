# Relatório de Diagnóstico e Auditoria Técnica — Fase F0 (EP-12)

Data: 2026-10-19  
Responsável: Antigravity AI Agent  
Status: Concluído  
Épico: [EP-12 — Prototype Engine & Design System Multiframework](../README.md)

---

## 1. Resumo Executivo

A auditoria F0 investigou a estrutura dos arquivos legados de Design System e protótipos do projeto `saude-dispensacao`, o pipeline de renderização e inspeção do Ateliê, e os serviços backend associados.

A causa raiz da impossibilidade de inspecionar adequadamente o protótipo do DIS (`dis-fluxo-paciente`) foi plenamente identificada e comprovada: **uma combinação de bloqueio de Content Security Policy (CSP) nos scripts do cabeçalho, destruição destrutiva do DOM pelo runtime do DataChef (`#dc-root`) e perda dos identificadores `data-pid` na reconciliação do React.**

---

## 2. Inventário dos Arquivos Monolíticos Legados

| Arquivo | Tamanho | Linhas | Papel / Conteúdo Principal |
|---|---|---|---|
| `projects/saude-dispensacao/design/dis-design-system.html` | 1.087 KB | 1.798 | Catálogo completo do Design System DIS: variáveis de tema CSS (`:root`), tipografia Noto Sans, 32 componentes em bundle JavaScript global (`window.DS`), demonstração visual interativa e ícones FontAwesome embutidos em paths SVG. |
| `projects/saude-dispensacao/design/dis-fluxo-paciente/Main.dc.html` | 57 KB | 587 | Fluxo completo de dispensação do paciente: template declarativo DataChef (`<x-dc>`, `<x-import>`, `<sc-if>`, `<sc-for>`) e classe de estado `Component extends DCLogic` com todas as regras de negócio de dispensação, busca, receitas e anotações. |
| `projects/saude-dispensacao/design/dis-fluxo-paciente/support.js` | 45 KB | 49 (min) | Runtime do compilador DataChef: substitui a tag `<x-dc>` por `<div id="dc-root">`, compila o template em Virtual DOM e instancia o React de forma assíncrona. |
| `projects/saude-dispensacao/design/prototypes/dis-fluxo-paciente-inspecao/` | ~62 KB | Múltiplos | Cópia criada pelo importador automático contendo `proto.json`, `head.html` e `screens/home.html` com injeção rasa de atributos `data-pid`. |

---

## 3. Diagnóstico do Pipeline: Por que o Ateliê falha no DIS

### 3.1. Caso de Sucesso (`fluxo-de-exemplo`)
- Utiliza HTML estático semântico puro com tags HTML nativas (`div`, `header`, `table`).
- Cada elemento possui um atributo `data-pid="p-X"`.
- O script `prototype-bridge.js` é executado síncronamente ao carregar o `body`, extrai a árvore DOM através dos seletores e atributos existentes, e envia as mensagens `HARNESS_PROTO_READY` e `HARNESS_PROTO_TREE` via `postMessage`.
- O Ateliê recebe a mensagem e renderiza perfeitamente a árvore de camadas e o painel de propriedades.

### 3.2. Causa Raiz da Falha no DIS (`dis-fluxo-paciente`)
1. **Bloqueio de CSP no `prototype-renderer.service.js`:**
   O backend gera um CSP restritivo (`script-src 'self' ... 'nonce-XXXX'`). O serviço injeta o `nonce` apenas nos scripts presentes em `screens/home.html`, mas **não aplica o nonce nos scripts de `head.html`** (`vendor/react.js`, `vendor/react-dom.js`, `support.js`, `bundle.js`). Com isso, os navegadores modernos bloqueiam o carregamento dos scripts essenciais do DIS por violação de segurança.
2. **Substituição destrutiva do DOM pelo `#dc-root`:**
   Quando `support.js` tenta executar, ele localiza a tag `<x-dc>` e executa `s.replaceWith(i)` onde `i = document.createElement("div"); i.id = "dc-root"`. Esta operação remove do DOM todos os elementos originais e seus atributos `data-pid` gerados pelo importador.
3. **Perda de `data-pid` no React Virtual DOM:**
   Os componentes React renderizados dentro de `#dc-root` são gerados dinamicamente sem os atributos `data-pid`. Quando o usuário clica em qualquer botão, tabela ou card, a função de seleção (`target.closest("[data-pid]")`) retorna nulo, impossibilitando a seleção bidirecional.
4. **Assincronismo não orquestrado com o `prototype-bridge.js`:**
   O `prototype-bridge.js` dispara `sendFullTree()` no evento imediato de carregamento. Como a compilação do DataChef e a renderização do React ocorrem após o ciclo inicial, a ponte envia uma árvore vazia ou com nós fantasmas.

---

## 4. Matriz de Aproveitamento de Contratos e Serviços

| Módulo / Serviço | Decisão | Racional Técnico |
|---|---|---|
| `ui/server/services/prototype-renderer.service.js` | **Estender** | Manter a montagem de telas e injeção de CSS, corrigindo o tratamento de nonces em `head.html` e suporte a scripts modulares. |
| `ui/public/js/modules/prototype-bridge.js` | **Estender** | Adicionar detecção de componentes via MutationObserver e suporte ao handshake de prontidão (`HARNESS_PROTO_READY` sob demanda). |
| `ui/server/services/prototype-artifact-import.service.js` | **Substituir / Evoluir** | O importador atual faz parsing superficial com regex. Deve ser substituído pelo pipeline semântico da F4 que decompõe o DOM em nós canônicos `PrototypeNode`. |
| `ui/public/js/modules/prototype-atelier.js` | **Reutilizar** | Gerenciador de layout, colunas responsivas, seleção de telas e abas funcionam com alta qualidade. |
| `ui/public/js/modules/prototype-catalog.js` | **Reutilizar** | Catálogo de protótipos e componentes pronto para listar componentes do Registry. |
| `tools/lib/project-mcp.js` | **Estender** | Adicionar ferramentas do MCP para consulta do Design System Registry e compilação de protótipos. |

---

## 5. Achados para o Piloto `AnnotationList`

O componente **AnnotationList** (`dis.annotation-list`) foi localizado no monólito de Design System (`dis-design-system.html` / bundle de inspeção, linhas 1459-1463):
```javascript
function AnnotationList(p) {
  return h("div", { className: "dis-notes" }, h(Accordion, {
    size: "sm",
    single: true,
    headingLevel: 3,
    items: (p.items || []).map(function (n, i) {
      return {
        title: n.date,
        defaultOpen: i === p.defaultOpenIndex,
        content: h(Fragment, null, n.text, n.source ? h("span", { className: "dis-notes__src" }, n.source) : null)
      };
    })
  }));
}
```

### Contrato do Piloto:
- **Dependências:** `Accordion`, `Fragment`, ícones `chevron-down`/`chevron-up`, classes CSS `.dis-notes` e `.dis-notes__src`.
- **Props:** `items: Array<{ date: string, text: string, source?: string }>`, `defaultOpenIndex: number`.
- **Validação:** A isolação deste componente em Vanilla HTML/CSS/JS provará a viabilidade de fracionamento de todo o catálogo.

---

## 6. Conclusão da Fase F0

Com o diagnóstico confirmado e reproduzível, os contratos da Fase F1 (Registry) e F3 (Prototype Schema) possuem agora dados concretos do repositório, garantindo que as implementações das próximas fases resolverão a causa raiz sem especulação.
