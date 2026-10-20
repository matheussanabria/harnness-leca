# Notas de desenvolvimento — histórias reais do DIS

Data: 2026-10-19

## Resultado

O módulo Scrum passou a compor três fontes com responsabilidades separadas:

- `_jira-dis.json`: identidade, título, tipo, status Jira, referência de épico e relacionamentos;
- `doc/scrum/DIS-*/user-story.md`: descrição, critérios de aceite, cenários e links documentais;
- `projects/<slug>/scrum.json`: sprint, coluna local, mapeamento de status e edições explícitas.

O snapshot é somente leitura e continua fora do Git. Sua coleta permanece a cargo do script PowerShell local que chama a API REST v2 do Jira interno com PAT em variável de ambiente. O Harness não lê token, não chama o Jira e não usa a skill de publicação para exportação.

## Decisões

- Campos ausentes não recebem defaults: pontos, prioridade e responsável ficam nulos.
- Registros antigos gerados pelo importador fictício não são aceitos como conteúdo de origem. Somente `sprintId` e `status` locais são preservados automaticamente.
- Alterações manuais de conteúdo ficam em `localOverrides` e são identificadas pela proveniência.
- Status Jira e coluna do quadro são campos distintos. O endpoint `POST /api/project/:slug/scrum/status-mapping` persiste o mapeamento configurável.
- O clique no cartão abre um painel lateral de leitura; a edição exige ação explícita.
- Relações permitem navegar entre histórias sem desmontar o Kanban.

## Validação de referência

Com o snapshot local de 473 issues, a composição resultou em 449 histórias e 24 épicos. A `DIS-499` foi resolvida com épico `DIS-432`, status Jira `SELECIONADO`, 14 critérios, 16 cenários e 7 relacionamentos. Pontos, prioridade e responsável permaneceram não informados.

Testes e verificações:

```text
node --test tests/project-scrum-sources.test.js
npm.cmd run check
```

## EP-05.01 — Migração compatível de status

### Implementado

- Schema Scrum v2 aditivo, preservando o campo `status` e introduzindo `laneId`.
- Mapeamento compatível dos quatro status legados para as raias propostas.
- Status desconhecidos preservados com `laneId: null` e registrados em `unmappedStatuses`.
- Migração automática e idempotente na primeira leitura de um `scrum.json` v1.
- Backup único `scrum.v1.backup.json`, escrita atômica e rollback interno.
- Respostas compostas expõem `schemaVersion` e `migrationHistory`.
- Criação e movimentação de histórias mantêm `status` e `laneId` coerentes.

### Compatibilidade e limites

- Consumidores atuais continuam lendo `todo`, `in_progress`, `review` e `done`.
- Snapshots Jira e documentos Markdown permanecem somente leitura.
- A configuração das 12 raias não foi antecipada; permanece na EP-05.02.
- Nenhum arquivo real de projeto foi migrado pelos testes; a migração ocorre na primeira leitura normal.

### Evidências

- 12/12 testes focados aprovados, incluindo idempotência, backup, rollback e status desconhecido.
- Suíte integral: 478/478 testes aprovados.
- Checagem de tipos focada sem erros.
- `npm run check`: 459 JavaScript e 10 JSON sem erro.

## EP-05.02 — Doze raias configuráveis

### Implementado

- Catálogo canônico com 12 IDs estáveis, ordem reservada para a EP-05.03 e atributos editáveis separados.
- Persistência de `lanes` por projeto sem alterar `schemaVersion: 2`.
- Validação estrita impede criação, exclusão, duplicação ou troca de IDs.
- API `POST /api/project/:slug/scrum/lanes` e modal acessível para nome, descrição, cor, visibilidade e ativação.
- Kanban projetado pelas raias do backend e cartões classificados por `laneId`; `status` permanece legado.
- Mapeamentos antigos de status são convertidos para IDs de raia na leitura.

### Limites preservados

- Reordenação pertence à EP-05.03.
- Movimentação e transições pertencem à EP-05.04.
- Impedimentos, filtros e métricas pertencem à EP-05.05.
- Testes de persistência usam somente diretórios temporários.

### Acessibilidade

- Modal usa `dialog` nativo, `aria-labelledby`, `aria-describedby`, labels explícitos por agrupamento, foco inicial e fechamento por Escape.
- Estado inativo possui texto, sem depender apenas de cor; controles têm foco visível e alvo mínimo de 44 px nos botões.

| Princípio WCAG 2.1 AA | Resultado da auditoria estrutural |
|---|---|
| Perceptível | Labels visíveis; ícones decorativos ocultos do leitor; estado inativo também textual; tokens de texto existentes mantêm contraste nos temas claro e escuro. |
| Operável | `dialog` nativo contém o foco, Escape fecha, ordem DOM é lógica, foco inicial e `:focus-visible` estão definidos; alvos interativos recebem 44 px. |
| Compreensível | Nome, cor, descrição, visibilidade e ativação têm rótulos; limites e obrigatoriedade usam validação HTML e erro da API é apresentado pelo toast compartilhado. |
| Robusto | `fieldset`/`legend`, `label`, `input`, `textarea`, `button` e relações ARIA usam elementos e referências válidos. |
| Não aplicável / pendente manual | Não há imagens, vídeo ou animação. Leitor de tela real e axe não fazem parte da infraestrutura automatizada atual e ficam como validação manual de navegador. |

### Evidências

- 18 testes focados aprovados antes da suíte integral.
- `npm run check`: 476 JavaScript e 10 JSON sem erro.
- `npm run types` permanece no baseline global conhecido; os handlers globais seguem a dívida já existente da UI.

## EP-05.03 — Reordenação horizontal persistida

### Implementado

- `order` persistido como permutação completa e contígua dos 12 IDs canônicos, sem alterar `schemaVersion: 2`.
- `lanesRevision` aplicado à configuração e à reordenação; revisão obsoleta retorna HTTP 409 sem gravar.
- Endpoint `POST /api/project/:slug/scrum/lanes/order` compartilhado pelo arraste e pelos botões mover à esquerda/direita.
- Ordem das raias visíveis calculada separadamente, preservando as posições das raias ocultas.
- Reordenação mantém histórias, `status`, `laneId`, sprints e épicos intactos; editar atributos depois mantém a ordem.

### Acessibilidade

| Princípio WCAG 2.1 AA | Resultado da auditoria estrutural |
|---|---|
| Perceptível | Ícones FontAwesome são decorativos e o estado/ação possui texto acessível; nenhuma informação depende apenas de cor. |
| Operável | Botões semânticos oferecem alternativa completa ao arraste, têm foco visível, são desabilitados nos extremos e chegam a 44 px em ponteiros de toque. |
| Compreensível | Rótulos anunciam raia e direção; sucesso ou conflito usa região `aria-live="polite"`. |
| Robusto | Controles usam `button`, nomes acessíveis e foco restaurado no handle da raia após nova renderização. |
| Pendente manual | Axe e leitor de tela real não estão disponíveis na suíte; permanecem como validação manual em navegador. |

### Evidências

- Suíte integral: 518/518 testes aprovados.
- `npm run check`: 482 JavaScript e 10 JSON sem erros.
- O typecheck global permanece no baseline conhecido; nenhum erro foi encontrado no recorte dos módulos Scrum alterados.
- Testes de persistência usam diretórios temporários e não alteram `scrum.json` real.

## EP-05.04 — Movimentação de histórias e transições

### Implementado

- Matriz baseada na sequência canônica dos 12 IDs, independente do `order` visual.
- Somente avanço ou retorno adjacente; no-op, salto, ID inválido e raias inativas são rejeitados antes da escrita.
- `fromLaneId` obrigatório detecta concorrência e produz HTTP 409 sem sobrescrever o estado atual.
- `laneId` preciso e os quatro status legados são atualizados em conjunto; edição genérica não pode contornar o comando auditável.
- `transitionHistory` registra origem, destino, status, instante e proveniência no mesmo `scrum.json` schema v2.
- Histórias Jira materializam somente o estado local; snapshot, identidade e conteúdo de origem permanecem intactos.
- Drag-and-drop e botões anterior/próxima usam `POST /scrum/story/transition`; o drawer apresenta a trilha da história.

### Acessibilidade

| Princípio WCAG 2.1 AA | Resultado da auditoria estrutural |
|---|---|
| Perceptível | Movimento não depende de cor; botões possuem nomes com história, direção e destino; ícones FontAwesome são decorativos. |
| Operável | Botões semânticos substituem integralmente o drag, possuem foco visível, estados desabilitados e alvos de 44 px em ponteiros de toque. |
| Compreensível | Sucesso, erro e conflito são anunciados em região `aria-live="polite"`; a edição explica que a etapa muda no quadro. |
| Robusto | O backend valida a mesma operação para mouse e teclado; após renderização ou conflito o foco retorna ao cartão. |
| Pendente manual | Axe, contraste calculado e leitor de tela real permanecem validações manuais de navegador por ausência dessas ferramentas na suíte. |

### Evidências

- 33/33 testes focados das histórias Scrum aprovados.
- Suíte integral no estado compartilhado final: 544/544 testes aprovados.
- `npm run check`: 492 JavaScript e 10 JSON sem erros; typecheck focado sem erros novos.
- Testes usam somente diretórios temporários e não alteram `scrum.json` real.
