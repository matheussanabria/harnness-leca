# ADR-015: Rotas canônicas no catálogo e workflows globais

- Status: aceita (EP-08, histórias 08.07 e 08.08)
- Data: 2026-11-09
- Relacionados: ADR-006 (estados ortogonais), ADR-014 (diagramas nativos), EP-08 (Agentes e workflows)

## Contexto
Workflows eram acessíveis apenas dentro de um projeto específico no Design. No Catálogo de capacidades, apenas Agentes e Skills eram listados. Ao navegar em cross-references entre workflows, agentes e skills, a URL não refletia o recurso atual, tornando impossível usar o histórico do navegador (botão "Voltar"), criar links diretos (deep linking) ou atualizar a página sem perder o estado. Além disso, blocos Mermaid de documentação de workflows eram exibidos como texto monoespaçado sem renderização gráfica.

## Decisão
1. **Unificação Global no Catálogo**: O Catálogo passa a incluir uma aba de "Workflows", agregando definições embutidas do Harness e descobertas nas pastas do usuário (`~/.gemini/workflows`, `~/.claude/workflows`), do sistema e dos projetos.
2. **Rotas Canônicas REST**:
   - `/catalogo` — listagem geral
   - `/catalogo/:kind` — listagem por categoria (`workflows`, `skills`, `agents`, etc.)
   - `/catalogo/:kind/:id` — visualização e abertura direta do item com decodificação segura
   - Suporte do servidor estático (`static.controller.js`) para todos os subcaminhos de `/catalogo/*`, servindo a casca `catalogo.html`.
3. **Gerenciamento de Histórico sem Reload**: O módulo cliente `catalogo-router.js` utiliza a History API (`pushState`, `replaceState`, `popstate`), permitindo navegação bidirecional instantânea entre workflows e suas dependências (skills e agentes).
4. **Renderização Segura de Diagramas Mermaid**: Blocos de Markdown com linguagem `mermaid` são renderizados como SVGs vetoriais via `mermaid-renderer.js`, com `securityLevel: "strict"`, sem emojis, tema dark integrado e alternância sob demanda para o código fonte.

## Consequências
- A experiência de navegação passa a se comportar como uma SPA moderna e consistente.
- Usuários e agentes podem referenciar e compartilhar URLs diretas para qualquer workflow, agente ou skill.
- O consumo de recursos no frontend permanece otimizado com lazy loading do bundle Mermaid.
