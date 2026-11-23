# Design System dos Codificadores de Negócios

O DS padrão de todos os projetos do harness. Nasceu dentro de `projects/57multimarcas`
e foi promovido a global: são os mesmos 50 componentes, com o namespace `m57` trocado
por `cn`.

## A regra

**Componentes são globais. Tokens são por marca.**

Nenhum dos 50 componentes traz cor **de marca** fixa: o CSS consome `var(--token)`
(132 usos) e as classes são genéricas (`.btn`, `.btn--primary`). Por isso um projeto
não precisa de uma cópia do DS para ter a cara dele — basta redefinir os tokens da
marca.

Os 31 literais de cor que restam no bundle são todos neutros: 23 `#fff`, 5 sombras
`rgba(9,30,66,…)` (o `--neutral-body` com alpha) e 2 no rodapé. Nenhum vermelho do
57Multimarcas vazou para dentro de componente.

## As três camadas

| Camada | Arquivo | Para quê |
|---|---|---|
| 1. Base | `global/design/defaults.json` | Vale para todo projeto. É aqui que mora `designSystem.ref: "codificadores"`, que faz o DS global ser o padrão. |
| 2. DS nomeado | `global/design/design-systems/<ref>.json` | Um DS inteiro: provider, caminhos, framework, estágios. Hoje: `codificadores` (global) e `procempa-dis` (Prontuário e Dispensação). |
| 3. Projeto | `projects/<slug>/design/profile.json` | O que aquele projeto muda. `ref` troca o DS inteiro; `overrides` troca campos pontuais. |

Resolvido por `ui/server/services/design-profile-resolver.service.js`, na ordem
defaults → DS nomeado → projeto, com `deepMerge`. O perfil resultante traz
`designSystemRef` e `designSystemOrigin` (`global` | `projeto` | `nenhum`).

## Os três casos que existem hoje

**Projeto novo, sem `profile.json`** — herda tudo. Usa os 50 componentes e a paleta
global. Nada a configurar.

**Projeto com a própria marca** (57multimarcas) — mantém os componentes do global e
troca só os tokens:

```json
{
  "schema": 1,
  "designSystem": {
    "ref": "codificadores",
    "overrides": { "tokensCss": "projects/57multimarcas/design/tokens.css" }
  }
}
```

E o `tokens.css` do projeto importa o global e redefine apenas as variáveis de marca
(`--primary-*`, `--highlight-*`), não as 28.

**Projeto com DS próprio de verdade** (Prontuário, Dispensação) — aponta para outro
`ref` e não enxerga o DS global:

```json
{ "designSystem": { "ref": "procempa-dis", "overrides": { "componentsDir": "doc/design-system" } } }
```

## O catálogo (registry)

`loadRegistry(projectDir)` empilha dois registries: o global por baixo
(`global/design/ds/registry.json`), o do projeto por cima
(`projects/<slug>/design/ds/registry.json`). A sobrescrita é **por componente**, pelo
id — um projeto pode substituir `cn.button` e continuar herdando os outros 49. Cada
componente devolvido leva `origin: "global" | "projeto"`.

Três garantias valem a pena enunciar, porque são o que mantém a herança viva:

1. `saveRegistry` **nunca** escreve no global. Um projeto que consome o DS não o altera.
2. `registerComponent` parte da camada do projeto (`loadProjectRegistry`), não da
   mesclada — senão o primeiro salvamento copiaria os 50 componentes globais para
   dentro do projeto e a herança morreria ali.
3. `registerImplementation` em componente herdado cria a sobrescrita local: o projeto
   passa a ter a sua versão daquele componente, e só dele.

Coberto por `tests/design-registry-global.test.js` (14 casos).

## Promover um componente ao global

Quando um componente nasce num projeto e serve a todos:

1. mover a pasta para `global/design/ds/components/<slug>`;
2. trocar o `id` do `manifest.json` para `cn.<slug>`;
3. registrar em `global/design/ds/registry.json` e descrever em `ds-index.md`;
4. remover a entrada do registry do projeto, para ele voltar a herdar.

O inverso — um projeto que precisa de uma versão só sua — é o item 3 das garantias:
não mexa no global, grave no projeto.

## Pendências

- **A paleta `--primary-*` / `--highlight-*` de `global/design/ds/tokens.css` é
  provisória**, à espera das cores oficiais dos Codificadores de Negócios. Os neutros
  e os estados (danger/success/warning) são genéricos e devem ficar.
- Os manifests mantêm `documentation.prototypeId: "design-system-v2-inspecao"`, a tela
  onde os componentes foram desenhados, que vive em `projects/57multimarcas`. Fora
  dele o preview cai no renderizador genérico — o controller checa a existência do
  protótipo antes de redirecionar.
- `tools/import-dc-design-system.js` e `tools/ds-sync.js` ainda escrevem no caminho do
  projeto; quando forem usados para o DS global, precisam apontar para
  `global/design/ds`.
- **`.footer__legal` tem contraste de 2,5:1** (`--neutral-base` sobre o literal
  `#050f22`), abaixo do mínimo de 4,5:1 para texto. Problema herdado, não introduzido
  aqui. A correção é no `footer.css` de origem, seguida de regeração do bundle:
  tokenizar `#050f22` e `#c7d1db` e clarear o texto.

## Contraste da paleta nova

Medido, para registro — a troca de vermelho por azul não degradou nada:

| Par | 57Multimarcas | Global (novo) |
|---|---|---|
| `#fff` sobre `--primary-interactive` | 4,59:1 | **8,31:1** |
| `--primary-headings` sobre branco | — | 14,86:1 |
| rodapé (`#c7d1db` sobre `--primary-headings`) | 7,11:1 | **9,6:1** |

`--highlight-focus` foi trocado de `#ff7f50` (2,5:1, abaixo do mínimo de 3:1 para
anel de foco) para `#cc5f00` (4,04:1).
