---
id: EP-22-spec
titulo: "Navegação de projetos: spec do B.A. e do UX/UI Designer"
epico: EP-22
tags: [harness-evolution, epico, projetos, navegacao, ux, spec]
---

> Insumo do [EP-22](README.md). Onde esta spec e as histórias divergirem, valem as histórias (22.01 a 22.06): por exemplo, o modelo puro fica em `ui/public/js/shared/projetos-model.js` e as rotas entram no agregador `ui/server/routes`, e não no `router.js`.

# Navegação de projetos no Harness: story (B.A.) e protótipo (UX/UI)

Entrega dos agentes `business-analyst` e `ux-ui-designer` do DAI, escrita sobre o código atual do harness-leca (lido em 16/11/2026). Tudo aqui é proposta para o Matheus aprovar antes de o DEV implementar.

---

# PARTE 1. Business Analyst: `01-story.md`

## 1.1 Pedido original

"Melhorar a UX/UI na navegação de projetos: barra de pesquisa, nova aba para todos os projetos, filtros por categoria/tags de cada projeto."

## 1.2 AS-IS: o que existe hoje (com evidência)

| # | Situação | Onde está | Efeito para o usuário |
|---|---|---|---|
| 1 | O seletor de projeto do cabeçalho é um `<select>` nativo com 25 projetos, em ordem alfabética, sem busca nem agrupamento | print do Harness; slot `data-slot="left"` em `app-header.js` | Achar `meus-treinos` ou `saude-prontuario` exige rolar a lista. Não dá para digitar parte do nome |
| 2 | `/overview` já é uma lista de "todos os projetos", mas serve de painel de sincronização e é paginada no servidor (10/25/50) | `overview.html`, `overview.js` | Não é um lugar de navegação: o foco é sync, extração e memória |
| 3 | `overview.js` tem `OV.query` e `SORT_FIELDS`, mas o HTML não tem campo de busca nem cabeçalhos ordenáveis | `overview.js` linhas de estado e `visibleProjects()` | Funcionalidade pela metade: existe no código, não existe na tela |
| 4 | Se a busca fosse ligada hoje, filtraria só os itens da página atual, porque a paginação é do servidor e o filtro é do cliente | `loadOverview()` + `visibleProjects()` | Busca mostraria "nenhum resultado" para projetos que existem na página 2 |
| 5 | Projeto não tem categoria nem tags. `project.service.js` lê slug, instruções, memória, chats e `groups.json` | `project.service.js` | Não há como agrupar `minha-*` (pessoal) separado de `saude-*` (trabalho). "Grupos" hoje classificam conversas, não projetos |
| 6 | Trocar de projeto passa por `projectSelection.select()`, que persiste em URL (`?p=`), localStorage e backend, e bloqueia se houver alteração não salva | `project-selection.js` | Qualquer novo seletor precisa reaproveitar isso, senão quebra a proteção de alterações não salvas |

## 1.3 Story

**Como** Matheus, que mantém cerca de 25 projetos no Harness (trabalho, negócios, pessoais e de plataforma),
**quero** encontrar e abrir qualquer projeto em poucos segundos por busca, categoria ou tag, e ter uma aba dedicada que mostre todos eles,
**para** não perder tempo rolando uma lista e para ver rapidamente o que está ativo, parado ou com pendências em cada área da minha vida e do trabalho.

Valor: reduz o custo de trocar de contexto. Hoje cada troca é rolar, ler 25 nomes e clicar.

## 1.4 Escopo (fatias de valor, em ordem de entrega)

| Fatia | Entrega | Valor sozinha |
|---|---|---|
| F1 | Seletor do cabeçalho pesquisável (combobox) com atalho de teclado | Resolve a dor diária sem depender de nada novo no backend |
| F2 | Metadados do projeto: 1 categoria + tags, gravados em `projects/<slug>/project.json` | Base para tudo que filtra |
| F3 | Nova aba "Projetos" (`/projetos`) com busca, filtros por categoria e tags, ordenação e visões cards/tabela | A navegação completa que o pedido descreve |
| F4 | Editar categoria e tags pela própria aba (sem abrir arquivo) | Fecha o ciclo; sem isso o Matheus edita JSON na mão |

F1 e F3 funcionam com a classificação inicial vinda de uma lista fixa; F2 e F4 tornam a classificação editável.

## 1.5 Critérios de aceite

**Seletor do cabeçalho (F1)**
- Ao abrir o seletor, o campo de busca já está focado e a lista mostra primeiro Fixados e Recentes, depois Todos.
- Digitar filtra por slug, título e tags, sem diferenciar maiúsculas, minúsculas ou acentos.
- Setas movem a seleção, Enter abre o projeto, Esc fecha e devolve o foco ao botão que abriu.
- `Ctrl+K` abre o seletor em qualquer tela do harness (e `/` quando o foco não estiver em campo de texto).
- Escolher um projeto usa `projectSelection.select()`; se houver alteração não salva, mostra o aviso existente em vez de trocar.
- A última linha da lista é sempre "Ver todos os projetos", que leva a `/projetos`.

**Aba Projetos (F3)**
- Existe item "Projetos" no menu principal, com ícone FontAwesome e `aria-current` quando ativo.
- A tela carrega todos os projetos de uma vez (sem paginação do servidor) e filtra no cliente. Com 25 projetos isso é mais simples e correto do que paginar.
- Campo de busca, chips de categoria (uma opção marcada ou "Todas"), filtro de tags (várias; o projeto precisa ter todas as marcadas) e ordenação (mais recente, nome, nº de conversas).
- O contador diz "Mostrando N de 25 projetos" e é anunciado por leitor de tela quando muda.
- Há botão "Limpar filtros" sempre que existir algum filtro ativo.
- Busca, filtros, ordenação e visão (cards ou tabela) voltam como estavam ao reabrir a tela (estado de tela salvo no servidor, como EP-14.10 já faz em `overview`).
- Clicar no nome do projeto abre `/?p=<slug>`, igual ao comportamento atual da Visão geral.
- Cada projeto mostra categoria, até 3 tags (com "+N"), nº de conversas, data do último chat e pendências de revisão.

**Metadados (F2 e F4)**
- Projeto sem `project.json` aparece como categoria "Sem categoria" e sem tags, sem erro.
- `project.json` inválido não derruba a listagem: o projeto aparece sem metadados e a tela mostra aviso discreto.
- Alterar categoria ou tags grava de forma atômica e só é aceito de loopback (mesma regra das outras escritas do harness).
- Tags são normalizadas (minúsculas, sem espaços nas pontas, até 24 caracteres, no máximo 8 por projeto, sem duplicata).

## 1.6 Regras de negócio

- RN1. Cada projeto tem **uma** categoria e **zero ou mais** tags. Categoria responde "de que área é"; tag responde "o que tem dentro" (ex.: `angular`, `java`, `design-system`, `financeiro`).
- RN2. A taxonomia de categorias é global (`global/project-taxonomy.json`) e vale para todos os projetos, para não nascerem "Pessoal", "pessoal" e "Pessoais".
- RN3. Projeto arquivado some da busca e do seletor por padrão, mas aparece se o filtro "Arquivados" estiver ligado.
- RN4. "Grupos" continuam sendo classificação de conversas dentro do projeto. A nova classificação de projetos usa o nome **Categoria** e **Tags** para não confundir os dois.

## 1.7 Requisitos não funcionais

- Desempenho: abrir o seletor e filtrar em menos de 100 ms com 100 projetos; a lista leve vem de uma única chamada.
- Acessibilidade: padrão ARIA de combobox com lista; foco visível; alvos de toque de 44 px no mobile; categoria nunca indicada só por cor.
- Convenções do repositório: FontAwesome, zero emojis, arquivos abaixo de 300 linhas, testes no formato `node --test`, `MAPA.md` atualizado no mesmo commit.
- Segurança: `slug` sempre validado contra a lista real de projetos; metadados escapados na renderização (`esc`); escrita só em loopback.

## 1.8 Fora de escopo (desta entrega)

- Sugestão automática de categoria e tags por LLM (o `groups.js` já faz algo parecido para conversas; fica para depois).
- Mover ou renomear pastas de projeto pela interface.
- Busca dentro do conteúdo das conversas (isso é outra funcionalidade: busca global).
- Permissões por perfil: o harness é de uso pessoal.

## 1.9 Classificação inicial sugerida (para o Matheus validar)

Deduzida só pelos nomes das pastas em `projects/`. Marquei com `?` os que o nome não permite afirmar.

| Categoria | Projetos |
|---|---|
| Trabalho (Saúde) | saude-dispensacao, saude-prontuario |
| Negócios | 57multimarcas, vale-do-aroma, meu-restaurante, meu-inventario, contabilidade, conversor-relatorio-maquininhas, conversor-relatorio-maquininhas-meu |
| Pessoal | meu-gtd, minha-agenda, minha-carteira, minha-dieta, minha-rotina, minha-saude, meus-treinos |
| Plataforma e IA | harness-leca, dai, framework-componentes, antigravity-llm, plataforma?, openlab-2?, lovable?, cerebro-digital? |
| Sem categoria | inbox? |

## 1.10 Perguntas abertas (com dono)

| # | Pergunta | Dono | Minha recomendação |
|---|---|---|---|
| 1 | A aba nova se chama "Projetos" e a Visão geral continua como painel de sync, ou as duas se fundem? | Matheus | Manter separadas: Projetos para navegar, Visão geral para operar (sync, extração, memória) |
| 2 | Uma categoria por projeto, ou várias? | Matheus | Uma categoria e várias tags (RN1) |
| 3 | A tabela da seção 1.9 está certa? Principalmente `plataforma`, `openlab-2`, `lovable`, `cerebro-digital`, `inbox` | Matheus | Corrigir direto na tabela |
| 4 | Quer Fixados e Recentes no seletor? | Matheus | Sim, são o que mais acelera o uso diário |
| 5 | Quer poder arquivar projeto? | Matheus | Sim, com 25 projetos algum já está parado |
| 6 | Em quais telas o `Ctrl+K` pode conflitar com atalhos existentes (chat, Ateliê, Studio)? | DEV Frontend | Verificar `focus-manager.js` antes de registrar o atalho |

O que fica para outro papel: o desenho das telas (parte 2, UX), o contrato de API e os nomes de arquivo (ARQ e DEV, sugestão na seção 2.8).

---

# PARTE 2. UX/UI Designer: `03-prototipo.md`

Base: story da parte 1 e o design do harness como está hoje (tema escuro com `--bg`, `--line`, `--accent`, `--mute`; componentes `status-badge`, `btn-row`, `p-card`, `eng-chip`; ícones FontAwesome; layout de cards abaixo de 1024 px e tabela acima).

## 2.1 Princípios aplicados

- Reaproveitar o que já existe (`p-card`, `status-badge`, `pager`, chips) antes de criar componente novo.
- Uma pergunta por tela: o seletor responde "quero ir para o projeto X, rápido"; a aba responde "o que eu tenho e onde está".
- Teclado primeiro no desktop; toque confortável no mobile.
- Nada que dependa só de cor: cada categoria tem ícone e texto.

## 2.2 Mapa de navegação

```
Cabeçalho:  Harness | [ Projeto: harness-leca  v ]   Início  Projetos*  Visão geral  Diário  Consumo  Catálogo  Deploy  Escritório
                          |
                          +-- abre o seletor (Ctrl+K)
                                 +-- "Ver todos os projetos" --> /projetos

/projetos  : navegar, buscar, filtrar, classificar
/overview  : sincronizar, extração, revisões, memória   (continua como está, sem a lista de navegação duplicada na busca)
```

`*` Novo item do menu, ícone sugerido `fa-folder-tree`, entre "Início" e "Visão geral".

## 2.3 Seletor do cabeçalho (F1), desktop

Fechado (substitui o `<select>` nativo):

```
+------------------------------------------+
| [fa-folder] framework-componentes  [v]   |   title: "Trocar de projeto (Ctrl+K)"
+------------------------------------------+
```

Aberto (painel de 420 px, abaixo do botão):

```
+--------------------------------------------------+
| [fa-magnifying-glass] Buscar projeto ou tag...   |   <- foco aqui ao abrir
+--------------------------------------------------+
| Categoria: [Todas] [Trabalho] [Negócios] [Pessoal] [Plataforma]  (rola na horizontal)
+--------------------------------------------------+
| FIXADOS                                          |
|  [fa-thumbtack] harness-leca        Plataforma   |
|  [fa-thumbtack] saude-dispensacao   Trabalho     |
| RECENTES                                         |
|  framework-componentes  (ativo)     Plataforma   |
|  dai                                Plataforma   |
|  meu-gtd                            Pessoal      |
| TODOS (25)                                       |
|  57multimarcas                      Negócios     |
|  antigravity-llm                    Plataforma   |
|  ...                                             |
+--------------------------------------------------+
| [fa-table-cells] Ver todos os projetos           |
+--------------------------------------------------+
| Ctrl+K abrir   setas navegar   Enter abrir   Esc fechar |
+--------------------------------------------------+
```

Comportamento:
- Digitando, as seções Fixados e Recentes somem e vira uma lista única "Resultados (N)", com o trecho que casou em destaque (negrito, não só cor).
- O projeto ativo tem selo "ativo" (o mesmo `status-badge badge-active` da Visão geral).
- Linha da lista: nome do projeto, categoria com ícone, e no máximo 2 tags em cinza.
- Máximo de 8 linhas visíveis por vez com rolagem interna; o rodapé "Ver todos" fica fixo.

Estados:

| Estado | O que aparece |
|---|---|
| Carregando | 5 linhas esqueleto (a lista leve vem de uma chamada) |
| Sem resultado | "Nenhum projeto com 'xyz'." + botão "Limpar busca" + link "Ver todos os projetos" |
| Erro | "Não foi possível carregar os projetos." + "Tentar de novo". O projeto atual continua utilizável |
| Troca bloqueada (alteração não salva) | Mantém o painel aberto e mostra no topo o aviso já usado pelo harness, sem trocar de projeto |
| Lista vazia (nenhum projeto) | Mesmo texto do estado vazio atual da Visão geral |

## 2.4 Tela Projetos (F3), desktop (acima de 1024 px)

```
+---------------------------------------------------------------------------------------------+
| Projetos                                                           [Cards] [Tabela]  25 total |
| [fa-magnifying-glass] Buscar por nome, categoria ou tag...                           [Ordenar: Mais recentes v]
+---------------------------------------------------------------------------------------------+
| Categoria:  (Todas 25) (Trabalho 2) (Negócios 7) (Pessoal 7) (Plataforma 8) (Sem categoria 1) |
| Tags:       [angular] [java] [design-system] [financeiro] [+ mais]        [ ] Mostrar arquivados |
| Filtros ativos: Pessoal x   gtd x                                       [Limpar filtros]     |
+---------------------------------------------------------------------------------------------+
| Mostrando 2 de 25 projetos                                                  (aria-live)      |
+---------------------------------------------------------------------------------------------+
| Projeto            Categoria   Tags           Conversas  Último chat   Revisões   Ações       |
| meu-gtd  (ativo)   Pessoal     gtd, obsidian  14         12/11/2026   2 pendentes [Abrir ->]  |
| minha-rotina       Pessoal     rotina         6          03/11/2026   em dia      [Abrir ->]  |
+---------------------------------------------------------------------------------------------+
```

Visão "Cards" (padrão abaixo de 1024 px, opcional acima):

```
+--------------------------------------+
| meu-gtd                    [ativo]   |
| [fa-user] Pessoal                    |
| gtd  obsidian                        |
| 14 conversas · último chat 12/11     |
| Revisões: 2 pendentes                |
| [Abrir ->]                  [...]    |
+--------------------------------------+
```

Decisões de design:
- Chips de categoria com contagem entre parênteses: o número já mostra onde cada projeto está e evita "filtro que dá zero".
- Tags em filtro múltiplo com regra E (o projeto precisa ter todas). Tag sem nenhum projeto após os outros filtros fica desabilitada, com a contagem 0.
- Ordenação em `<select>` nativo (acessível e simples) no cabeçalho dos cards; na tabela, cabeçalhos clicáveis com `aria-sort`.
- O botão Sync por linha que existe na Visão geral **não** vem para cá: aqui o foco é navegar. A ação principal é "Abrir".
- Menu `[...]` por projeto (F4): "Editar categoria e tags", "Fixar", "Arquivar".

## 2.5 Edição de categoria e tags (F4)

Diálogo `<dialog>` nativo, como os outros do harness:

```
+--------------------------------------------+
| Classificar: meu-gtd                    [x] |
|                                            |
| Categoria   ( ) Trabalho  ( ) Negócios     |
|             (o) Pessoal   ( ) Plataforma   |
|                                            |
| Tags        [gtd x] [obsidian x] [ digitar e Enter ]
|             Sugestões: angular  java  financeiro   |
|                                            |
| [ ] Fixar no seletor   [ ] Arquivar        |
|                                            |
|                       [Cancelar] [Salvar]  |
+--------------------------------------------+
```

Erros: tag com mais de 24 caracteres ou 9ª tag mostram mensagem ao lado do campo, sem fechar o diálogo. Falha ao salvar mostra o erro dentro do diálogo, mantém o que foi digitado e oferece "Tentar de novo".

## 2.6 Mobile (abaixo de 640 px) e tablet

- O botão do seletor mostra só o nome do projeto, truncado com reticências; toque abre **tela cheia** com o campo de busca no topo (teclado já aberto) e botão "Fechar".
- Na aba Projetos, os filtros ficam atrás do botão "Filtros (2)", que abre uma gaveta inferior com categoria, tags e arquivados, e o botão fixo "Ver 7 resultados".
- Só a visão de cards; a tabela não aparece abaixo de 1024 px (mesma regra atual de `.p-table` e `.p-cards`).
- Alvos de toque de pelo menos 44 px (regra já usada em `overview-projects.css`).
- O atalho `Ctrl+K` não se aplica; o botão do cabeçalho é a porta de entrada.

## 2.7 Estados da tela Projetos

| Estado | Comportamento |
|---|---|
| Carregando | Esqueleto de 6 cards ou linhas; filtros desabilitados |
| Vazio total | "Nenhum projeto ainda." com a dica atual de copiar `projects/_template` |
| Vazio por filtro | "Nenhum projeto com esses filtros." + botão "Limpar filtros" (nunca uma tela em branco) |
| Erro de carga | Mensagem + "Tentar de novo"; mantém os filtros escolhidos |
| Metadado inválido em algum projeto | O projeto aparece como "Sem categoria"; aviso discreto no rodapé: "1 projeto com metadados inválidos" |
| Salvando classificação | Botão "Salvar" vira "Salvando..." e desabilita; ao concluir, a linha se atualiza sem recarregar a página |

## 2.8 Acessibilidade (WCAG 2.1 AA)

- Seletor: `role="combobox"` no campo, `aria-expanded`, `aria-controls` apontando para a lista (`role="listbox"`), `aria-activedescendant` na opção destacada, e `role="option"` com `aria-selected`.
- Contador de resultados em região `aria-live="polite"`.
- Chips de categoria como grupo de rádio (`role="radiogroup"`); chips de tag como caixas de seleção.
- Ícones sempre acompanhados de texto ou `title`; ícone decorativo com `aria-hidden="true"`.
- Contraste mínimo de 4.5:1 para texto e 3:1 para bordas e foco; foco visível com o mesmo `outline: 2px solid var(--accent)` já usado nas listas.
- `prefers-reduced-motion`: abrir e fechar painel sem animação.
- Ordem de tabulação: busca, categoria, tags, arquivados, limpar, lista.

## 2.9 Handoff para o DEV

Sugestão de arquivos novos (seguindo as convenções do `MAPA.md`; o DEV e o ARQ confirmam nomes):

| Camada | Arquivo | Papel |
|---|---|---|
| Backend | `ui/server/services/project-meta.service.js` | Lê e grava `projects/<slug>/project.json` de forma atômica; normaliza tags; lê `global/project-taxonomy.json` |
| Backend | `ui/server/controllers/project-meta.controller.js` | `GET /api/projects` (lista leve: slug, categoria, tags, fixado, arquivado, nº de chats, último chat, pendências) e `POST /api/project/:slug/meta` (somente loopback) |
| Backend | `ui/server/routes/project-meta.routes.js` | Agrupa as rotas, para manter `router.js` abaixo do teto |
| Frontend | `ui/public/projetos.html` | Página nova, com `<header data-app-header data-current="projetos">` |
| Frontend | `ui/public/js/projetos.js` e `projetos-model.js` | Tela e regras puras (filtro, ordenação, contagens) testáveis sem DOM |
| Frontend | `ui/public/js/shared/project-picker.js` | Combobox do cabeçalho, usa `projectSelection.select()` |
| Frontend | `ui/public/js/shared/app-header.js` | Adicionar `{ id: "projetos", href: "/projetos", icon: "fa-folder-tree", label: "Projetos" }` em `NAV_ITEMS` e montar o seletor no slot `left` |
| Estilo | `ui/public/css/projetos.css` e `project-picker.css` | Reusar variáveis de `base.css` |
| Testes | `tests/projetos-model.test.js`, `tests/project-meta.test.js`, `tests/project-picker.test.js` | Filtro e ordenação, escrita atômica e normalização, navegação por teclado |

Pontos que o DEV precisa decidir com o UX:
- Como a lista leve de `/api/projects` evita o custo de `S.scan(slug)` por projeto (hoje `overviewCached` usa fingerprint de arquivos; reaproveitar esse cache).
- Se o estado da tela (filtros, ordenação, visão) entra em `screen-state` com a chave `projetos`, como a Visão geral faz (EP-14.10).
- Registro do `Ctrl+K` no `focus-manager.js` para não competir com campos de texto e com o Ateliê.
- Remover da Visão geral o campo `OV.query` morto, ou ligá-lo corretamente (ver item 3 e 4 do AS-IS).

## 2.10 Como validar depois de pronto

- Medir: tempo para abrir `meus-treinos` partindo de qualquer tela, antes (rolar o `<select>`) e depois (`Ctrl+K`, digitar, Enter). Meta: menos de 5 segundos.
- Verificação visual do seletor e da aba em 1440 px, 768 px e 390 px, nos estados da seção 2.7.
- Teste só com teclado: abrir, buscar, escolher e voltar sem usar o mouse.
- Teste com leitor de tela do anúncio "Mostrando N de 25 projetos".

---

Telas e estados cobertos: seletor do cabeçalho (fechado, aberto, sem resultado, erro, troca bloqueada), aba Projetos (cards, tabela, filtros, estados), diálogo de classificação, mobile e tablet. Falta, para o DEV decidir com o UX: o ícone final do item de menu e a gaveta de filtros no tablet (768 px), que pode seguir o desktop ou o mobile.
