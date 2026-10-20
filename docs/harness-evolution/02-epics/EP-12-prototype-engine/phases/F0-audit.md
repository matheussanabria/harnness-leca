# Fase F0: Diagnostico e Contratos Existentes

[Voltar ao EP-12](../README.md)

## 1. Visao geral da Fase F0

A Fase F0 e o ponto de partida do EP-12. Antes de codificar qualquer novo servico ou adaptador, esta fase realiza uma investigacao profunda e verificavel no repositorio para identificar:
1. Como os dois HTMLs monoliticos legados (`dis-design-system.html` e `dis-fluxo-paciente/Main.dc.html`) estao estruturados.
2. Por que o Atelie e o Inspetor de camadas conseguem inspecionar prototipos de exemplo (como `fluxo-de-exemplo`), mas falham ao carregar ou interpretar a arvore da tela DIS real (`#dc-root`, sandboxing, scripts acoplados).
3. Quais servicos existentes no backend (`ui/server/services/`) e no frontend (`ui/public/js/modules/`) ja possuem logica de extracao, inspecao, kits e catalogo que podem ser reutilizados ou estendidos.
4. O baseline visual e funcional de referencia para garantir regressao zero.

---

## 2. Historias da Fase F0

- **12.01 — Auditar os HTMLs monoliticos, MCP e snapshots:** Mapear o conteudo dos HTMLs gigantes, contratos de extracao, resolucao de dependencias e estado do MCP.
- **12.02 — Auditar o Atelie, importador, renderer e inspetor:** Rastrear o caminho completo de carregamento do prototipo, identificando os pontos exatos de falha com o DIS.
- **12.03 — Identificar contratos e funcionalidades reutilizaveis:** Mapear matriz Reutilizar / Estender / Substituir dos servicos existentes.
- **12.04 — Estabelecer baseline visual e funcional:** Capturar evidencias visuais, fluxos navegaveis e dependencias para comparacao.

---

## 3. Prompt de Auditoria Executavel para Agentes

Copie e execute o prompt a seguir para realizar o diagnostico completo no repositorio:

```markdown
### PROMPT DE AUDITORIA — FASE F0 (EP-12)

Voce e um Engenheiro de Software Especialista em Arquitetura de Design Systems e Engenharia de Prototipos.
Sua missao e executar a auditoria tecnica F0 do EP-12 no repositorio Harness Leca.

Siga rigorosamente as etapas abaixo e gere um relatorio detalhado em `docs/harness-evolution/02-epics/EP-12-prototype-engine/reports/F0-audit-results.md`:

#### 1. Auditoria dos Arquivos Legados de Prototipo e Design System
- Inspecione os caminhos:
  - `projects/saude-dispensacao/design/dis-design-system.html`
  - `projects/saude-dispensacao/design/dis-fluxo-paciente/Main.dc.html`
  - `projects/saude-dispensacao/design/dis-fluxo-paciente/support.js`
  - `projects/saude-dispensacao/design/prototypes/fluxo-de-exemplo/proto.json`
  - `projects/saude-dispensacao/design/prototypes/dis-fluxo-paciente-inspecao/proto.json`
- Determine:
  - Tamanho dos arquivos, numero de linhas e estrutura geral do DOM.
  - Onde estao declarados os estilos CSS (inline, tags <style>, arquivos externos).
  - Onde estao os scripts e como o estado da aplicacao e manipulado.
  - Origem e funcao do elemento `#dc-root` ou tags customizadas do DataChef/DIS.

#### 2. Auditoria do Pipeline do Atelie e Inspetor
- Inspecione os modulos do frontend:
  - `ui/public/js/modules/prototype-atelier.js`
  - `ui/public/js/modules/prototype-atelier-view.js`
  - `ui/public/js/modules/prototype-catalog.js`
  - `ui/public/js/modules/design-prototypes.js`
- Rastreie o fluxo de renderizacao:
  1. Como o prototipo e carregado no DOM/iframe.
  2. Como a arvore de camadas e extraida para o painel lateral.
  3. Por que o `fluxo-de-exemplo` funciona e o `dis-fluxo-paciente` falha.
  4. Quais erros sao emitidos no console ou falhas de comunicacao ocorrem.

#### 3. Auditoria dos Servicos Backend e MCP
- Inspecione:
  - `ui/server/services/project-design-context.service.js`
  - `ui/server/services/design-profile-resolver.service.js`
  - `ui/server/services/design-index.service.js`
  - `tools/lib/project-mcp.js`
- Mapeie:
  - Quais endpoints de API de design existem atualmente em `ui/server/routes/`.
  - Quais ferramentas MCP estao registradas para inspecao de componentes e prototipos.
  - Quais estruturas de dados sao devolvidas por essas rotas.

#### 4. Entregavel Final
Gere a matriz consolidada:
| Componente / Servico | Estado Atual | Diagnostico / Causa Raiz | Recomendacao (Reutilizar/Estender/Substituir) |
```

---

## 4. Criterios de Aceite da F0

1. Inventario exato de componentes e scripts do monólito DIS mapeado.
2. Causa raiz documentada e reproduzivel da falha de inspecao do DIS no Atelie.
3. Matriz de aproveitamento de servicos preenchida sem lacunas.
4. Baseline funcional e visual devidamente documentado.
