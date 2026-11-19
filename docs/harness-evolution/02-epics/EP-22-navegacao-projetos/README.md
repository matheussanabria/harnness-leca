---
id: EP-22
titulo: Navegação de projetos
prioridade: P1
status: planejado
depende: [EP-04, EP-14]
tags: [harness-evolution, epico, projetos, navegacao, ux]
---

# EP-22: Navegação de projetos

[Voltar ao índice](../../00-index.md)

## Objetivo

Achar e abrir um dos 25 projetos em poucos segundos: seletor pesquisável no cabeçalho, uma aba própria com todos os projetos e filtros por categoria e tags.

## Contexto

Hoje a troca de projeto é um `<select>` nos slots do cabeçalho: sem busca, sem agrupamento e com a lista inteira em ordem alfabética. A Visão geral tem `OV.query` e `SORT_FIELDS` no código, mas sem campo de busca nem cabeçalhos ordenáveis na tela. Não existe classificação de projetos: "Grupos" classificam conversas dentro de um projeto, não projetos.

## Insumos

- [Spec do B.A. e do UX/UI Designer](00-spec-ba-ux.md): AS-IS, história, critérios, regras RN1 a RN4, wireframes, estados e acessibilidade.
- Protótipo `navegacao-de-projetos` (8 telas) no Ateliê do projeto harness-leca, em `projects/harness-leca/design/prototypes/navegacao-de-projetos/`. Essa pasta não é versionada neste repositório.
- Design System `hl.*` (17 componentes, HTML e CSS vanilla) em `projects/harness-leca/design/ds/`. Serve de referência visual e de comportamento; no código real os componentes viram módulos ES (ver [mapa](../../../mapa/design/system/project-ds-hl.md)).

## Entrega

Seletor `Ctrl+K`, página `/projetos` (tabela e cards, busca, categoria, tags, ordenação, mobile) e classificação editável pela própria tela.

## Aceite do épico

- Abrir `meus-treinos` partindo de qualquer tela leva menos de 5 segundos (`Ctrl+K`, digitar, Enter), contra rolar o `<select>` hoje.
- Filtrar por categoria e tags na aba Projetos funciona com mouse, teclado e leitor de tela, em 1440, 768 e 390 px.
- Categoria e tags de um projeto são editadas sem abrir arquivo, e um `project.json` inválido não derruba nenhuma tela.

## Regras que valem para todas as histórias

- RN1. Cada projeto tem **uma** categoria e **zero ou mais** tags. Categoria responde "de que área é"; tag responde "o que tem dentro".
- RN2. Taxonomia de categorias global (`global/project-taxonomy.json`), para não nascerem "Pessoal", "pessoal" e "Pessoais".
- RN3. Projeto arquivado some do seletor e da lista, salvo com o filtro "Mostrar arquivados".
- RN4. Na interface use **Categoria** e **Tags** para projetos, para não confundir com **Grupos** de conversas.
- Escrita de metadados só em loopback; `slug` sempre validado contra a lista real de projetos; tudo que vem de metadado é escapado na renderização.
- Ícones apenas FontAwesome, zero emojis, arquivos abaixo de 300 linhas, linha no mapa (`docs/mapa/`) no mesmo commit.

## Decisões deste épico

1. **Modelo puro em `shared/`.** A spec previa `js/projetos-model.js`; como o seletor (`shared/`) e a página usam as mesmas regras, o arquivo fica em `ui/public/js/shared/projetos-model.js`.
2. **Rotas.** As rotas novas entram no agregador `ui/server/routes` (que exporta `ROUTES`), e não no `router.js`. A página `/projetos` precisa de uma entrada em `static.controller.js`, como `/overview` e `/diario`.
3. **Estado de tela.** A aba guarda filtros, ordenação e visão em `screen-state`, com uma entrada nova `projetos` (escopo global) no registro, como a Visão geral.
4. **Tags no mockup são ilustrativas.** A única classificação deduzida é a de categorias (spec §1.9); as tags reais começam vazias e são criadas pelo usuário.

## Ordem e paralelismo

```
22.01 metadados ──► 22.02 API ──┬──► 22.04 seletor ──► 22.05 aba Projetos ──► 22.06 classificar e fechamento
22.03 modelo puro ──────────────┘
```

22.01 e 22.03 não dependem uma da outra e podem ir em paralelo. Cada história é um commit.

## Frente e coordenação

Sem owner definido em `EPIC_OWNERS` (`tools/lib/coordination/config.js`): definir a frente antes de abrir a primeira história e rodar `node tools/coordination.js sync`.

## Histórias

| ID | Título | Status |
|---|---|---|
| [22.01](22.01-metadados-projeto.md) | Metadados do projeto e taxonomia de categorias | Planejada |
| [22.02](22.02-api-projetos.md) | API de projetos: lista leve e gravação de metadados | Planejada |
| [22.03](22.03-modelo-lista-projetos.md) | Modelo puro da lista de projetos | Planejada |
| [22.04](22.04-seletor-projeto.md) | Seletor de projeto pesquisável no cabeçalho | Planejada |
| [22.05](22.05-aba-projetos.md) | Aba Projetos: tabela, cards, busca e filtros | Planejada |
| [22.06](22.06-classificar-fechamento.md) | Classificar pela tela e fechamento do épico | Planejada |
