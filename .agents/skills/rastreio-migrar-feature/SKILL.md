---
name: rastreio-migrar-feature
description: Migra uma funcionalidade já documentada (dossiê, BDD, mapa-camadas.json) para o gate de rastreabilidade - escreve regras.md e rastreio.yml, liga o mapa às regras pelo campo rn e roda o gate. Use quando o usuário pedir para "migrar a funcionalidade X para o rastreio", "ligar o mapa às RN" ou "tirar o aviso G9 de X". Para um projeto sem config use antes rastreio-adocao.
---

# Migrar uma funcionalidade para o rastreio

Pré-requisito: `projects/<slug>/rastreio.config.json` válido (ver `rastreio-adocao`).

## Ressalva obrigatória

Escreva no `regras.md` da funcionalidade, e repita ao usuário: **"regras escritas a partir do dossiê, não relidas no código"**, a menos que cada regra tenha sido conferida no código. O gate confirma que os elos existem, não que a regra é verdadeira.

## Checklist por funcionalidade

1. Ler `_status.md`, o dossiê e o `mapa-camadas.json` (se houver).
2. Extrair as regras para `regras.md` com ids `<prefixo>-<slug>-nnn`; ids novos, nunca reaproveitar um id aposentado (G7). Para aposentar, liste em `descontinuados:`.
3. Criar o `rastreio.yml`: cada entrada com código existente e prova (teste da stack, request Postman ou `cobertos_por`) ou `lacuna` declarada.
4. Ligar o mapa: cada item de `telas[].regras` ganha `rn: ["<id>"]`. Item que é fato de arquitetura leva `sem_rn: "motivo"`. Funcionalidade sem tela própria declara `sem_mapa: { motivo, em: [slug] }` no `rastreio.yml`.
5. Conferir `testes.grupos[].st` contra a prova do rastreio: `sem-teste` com prova registrada é contradição (aviso G9); `teste-unitario`/`automatizado` sem nenhuma RN provada também.
6. Rodar `node tools/rastreio/cli.mjs --config <arquivo> --features <slug>` e `node tools/audit-layers-drift.js --repo <repo> --rastreio-config <arquivo> --feature <slug>`.
7. Corrigir o `_status.md` (G8) se as contagens divergirem.

## Fan-out opcional em subagentes Haiku

Serve para a parte mecânica (ligar mapa a RN em muitas funcionalidades). Modelo usado em 10/11/2026:

- Dê a cada subagente **uma funcionalidade**, com briefing fechado: arquivos que pode ler, saída esperada (lista `{tela, titulo, rn}`), regra de **reportar a dúvida em vez de inventar**.
- Quem aplica é um script que **só insere o campo `rn`**, com backup, sem reformatar o JSON. Não deixe o subagente reescrever o `mapa-camadas.json`.
- Custo medido: 85 a 114 mil tokens e 2 a 3 minutos por subagente; ele ligou mapa a RN corretamente e relatou as dúvidas.
- Limite: mudar `st` exige evidência no código e fica com quem tem o contexto, não com o subagente.

## Lição medida

Todo achado "o mapa diz X, a RN diz Y" foi conferido no código antes de corrigir; em 6 de 6 casos o **mapa** estava defasado, não a regra.
