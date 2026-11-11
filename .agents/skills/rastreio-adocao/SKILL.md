---
name: rastreio-adocao
description: Adota o gate de rastreabilidade (G1 a G9, tools/rastreio) em um projeto novo - cria o rastreio.config.json, a pasta de funcionalidades, o rastreio.yml e o regras.md a partir de BDD e testes existentes, e roda o gate. Use quando o usuário pedir para "adotar o rastreio", "ligar o gate num projeto", "criar o rastreio.config.json" ou "rastrear regras até o teste". Para migrar uma funcionalidade já documentada use rastreio-migrar-feature.
---

# Adoção do gate de rastreabilidade

O gate (`node tools/rastreio/cli.mjs --config <arquivo>`) confere **existência e consistência** do elo regra -> código -> prova. Ele **não** confere se a regra está certa nem se o teste prova a regra. Diga isso ao usuário no começo.

## Passo a passo

1. **Config.** Crie `projects/<slug>/rastreio.config.json` (D1). Campos: `docs.features` (obrigatório), `docs.postman`, `ids.regra` (letras e números, ex. `RN`, `BR`), `ids.placeholder`, `ids.postmanPrefixo`, `textos.linhaStatus`, `arquivos`, `stacks[]`. Stacks conhecidas: `junit`, `karma`, `pytest`; para outra, crie um adaptador em `tools/rastreio/adapters/` e registre em `index.mjs`. Só uma stack pode ficar sem `prefixo` (é a dona das referências de código). Modelos: `tests/fixtures/rastreio/saude-dispensacao.config.json` e `tests/fixtures/rastreio/pytest-project/rastreio.config.json`.
2. **Valide a config.** Rode o CLI; código 2 lista cada problema (campo ausente, caminho inexistente, regex inválida). Corrija até sair do 2.
3. **Uma funcionalidade por vez.** Em `<docs.features>/<slug>/` crie `regras.md` (regras de negócio) e `rastreio.yml` (entradas com `codigo`, a prova da stack, `postman` ou `cobertos_por`, ou `lacuna` declarada). O prefixo das regras é `<ids.regra>-<slug>-nnn`.
4. **Rode** `node tools/rastreio/cli.mjs --config <arquivo> --features <slug>` e leia os erros por gate (G1 a G9).
5. **Registre no projeto** a linha de rastreabilidade do `_status.md` (texto de `textos.linhaStatus`) para o G8.

## Armadilhas já vistas

- **G6 em Python/pytest:** `fontes_api` deve listar os arquivos de **teste**, não os de código. Listar código gera aviso de teste órfão que não existe, ou esconde os órfãos de verdade.
- Duas stacks sem `prefixo` tornam a referência de código ambígua: a config é recusada.
- `projects/` é ignorado pelo git: o config do projeto não é versionado. Para o CI (D4), mantenha uma cópia no repositório do projeto.
- Prova ausente não se inventa: declare `lacuna` com motivo. O gate aceita lacuna declarada, não prova inventada.
- Mudança de `st` (situação) em `mapa-camadas.json` exige evidência no código.

## Depois

Ligue o gate ao commit com o workflow `workflows/gate-local.md` desta skill.
