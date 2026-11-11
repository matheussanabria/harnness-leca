# Rota de entrega: completa ou curta

Toda mudança de código começa escolhendo a rota. Declare a rota no início da resposta, antes de codar.
O catálogo de workflows (`ui/server/services/orchestration/workflow-definitions.js`) é a fonte da lista de etapas;
este arquivo é a fonte da regra de quando usar cada rota.

## Qual rota

**Rota curta** só se TODAS as condições valerem:
1. Mexe em até 3 arquivos de código (sem contar testes e docs).
2. Não cria tela nova.
3. Não muda contrato (API, formato de arquivo, evento).

Se qualquer uma falhar, vale a **rota completa** (`feature-delivery`). Defeito urgente em produção usa o `hotfix`.

## Etapas da rota curta

| Etapa | Na rota curta | Como fica |
|---|---|---|
| Início | sim | dossiê em `docs/features/<slug>/` |
| História | obrigatória | critérios de aceite gravados na história (`node tools/scrum.js story update`) |
| BDD | obrigatório | `02-bdd.feature` com cenários `CP-nn` (feliz, alternativo, erro) |
| Protótipo | só com elemento visual novo | sem elemento visual novo: dispensado, motivo "Sem elemento visual novo" |
| Modelagem | dispensada | motivo "Dispensada na rota curta" |
| Desenvolvimento | obrigatória | worktree e branch próprios |
| Testes | obrigatória | um teste por cenário `@auto` |
| Revisão | obrigatória | revisão do diff (`code-review-checklist`) |
| Commit e PR | obrigatória | com aprovação do usuário |

Dispensar uma etapa sem registrar o motivo conta como etapa aberta no gate.
Elemento visual novo é qualquer coisa que o usuário passa a ver e que não existia: destaque, ícone, estado, tela.
Com elemento visual novo o protótipo é obrigatório e precisa de aprovação.

## BDD como proteção contra regressão

- Cada cenário tem um id `CP-nn` e uma tag: `@auto` (tem teste automatizado) ou `@manual` (só no navegador).
- O id do cenário `@auto` vai no título de um teste em `tests/*.test.js`, por exemplo `test("CP-04: ...")`.
- `tests/bdd-traceability.test.js` falha se um cenário `@auto` em `docs/features/*/02-bdd.feature` não tiver teste com o seu id.
- Mudança futura que quebre um cenário quebra o teste dele no `npm test`.

## Gate de saída

Antes de dizer que a história está entregue, rode:

`node tools/scrum.js story done-check <id> --tests ... --lint ... --browser ... --map ... --commit ...`

O gate lê o dossiê da história (`_status.md`, campo `story:`), exige cada etapa `done`, ou `skipped` com motivo,
e lista tudo que está aberto. Sem dossiê, declare `--stages na:<motivo>` e liste as etapas puladas na resposta.
O registro do dossiê é evidência declarada, não auditoria.
