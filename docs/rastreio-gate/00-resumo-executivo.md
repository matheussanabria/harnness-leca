# Harness: gate de rastreabilidade (rastreio) como infraestrutura reutilizável

**Resumo executivo** · Data: 10/11/2026 · Versão 1.0
**Status:** gate funcionando no projeto saude-dispensacao; generalização para o harness **ainda não iniciada**. Plano em [01-plano-execucao.md](01-plano-execucao.md).

## 1. O que existe hoje

No projeto saude-dispensacao há um gate que liga **regra de negócio, cenário, teste e código** e barra o commit quando a documentação deixa de refletir o código. Ele funciona, mas mora fora do harness, num diretório que não é repositório git, com caminhos do projeto escritos no código.

| Peça | Onde está | Situação |
|---|---|---|
| Contrato (rastreio.yml + regras.md, ids `RN-<slug>-nnn`) | `saude/dispensacao/doc/sistema/features/_contrato-rastreio.md` | Estável. 22 de 22 funcionalidades migradas |
| Gate `rastreio.mjs` (G1 a G9) | `saude/dispensacao/tools/doc-features/` | Passa nas 22 sem erro e sem aviso. 271 linhas, acoplado a Java, Karma, Postman e ao pacote `br.com.procempa` |
| Gate de cobertura e pre-commit (`cobertura.mjs`, `doc-gate.mjs`) | mesma pasta | Hook local rodou em commit real (web, `f101e35`) e passou |
| Mapa em camadas ligado ao rastreio (G9) | `mapa-camadas.json` de 14 funcionalidades, campo `rn` | Ligado. 8 funcionalidades sem tela própria usam `sem_mapa` |
| Skill `layer-map-exporter` | `~/.claude/skills/` | **Desatualizada**: não conhece `rn`, `sem_mapa`, `sem_rn` nem lê o `rastreio.yml` |
| `audit-layers-drift.js` | `harness-leca/tools/` | Devolve `testes: 0` fixo, ignora `testes.grupos` |

## 2. Por que generalizar

Cada projeto novo precisará do mesmo ciclo: **rastreio primeiro, mapa em camadas depois**. Hoje isso exigiria copiar e editar um script de 271 linhas. O ganho esperado é adotar o contrato em um projeto novo por configuração e skill, sem escrever código.

## 3. Direção recomendada

1. Mover o gate para `harness-leca/tools/rastreio/`, em módulos pequenos (limite de 300 linhas do harness), com **configuração por projeto** e **adaptadores por stack** (Java/JUnit, TypeScript/Karma, Postman).
2. Manter o contrato como está; só o que é do projeto (caminhos, prefixos, pacotes) sai do código e vai para a configuração.
3. Provar a portabilidade com um **projeto de fixtures** que não é o saude-dispensacao.
4. Transformar os fluxos repetíveis em skills e workflow: adoção do contrato, migração de uma funcionalidade e mapa em camadas a partir do rastreio.
5. Atualizar a `layer-map-exporter` e o `audit-layers-drift.js` para ler o rastreio.

## 4. Decisões que dependem do PM/dono do harness

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Onde fica a configuração do projeto | `projects/<slug>/rastreio.config.json` no harness, apontando para a pasta de docs do projeto |
| D2 | O que fazer com `saude/dispensacao/tools/doc-features` | Manter um wrapper fino que chama o harness com a configuração; remover a cópia do gate |
| D3 | O `doc-gate` (que aciona o agente de documentação) vai junto? | Sim, como workflow separado do gate, para não acoplar o gate a `claude -p` |
| D4 | Versionar `doc/` e `tools/` do projeto em git | Necessário para o CI chamar o gate; sem isso o gate só existe no hook local |

## 5. Riscos e limites que continuam

- O gate confere **existência e consistência**, não verdade: o G9 não detecta um `rn` apontado para a regra errada, e as regras foram escritas a partir de dossiês, sem reler todo o código.
- Dependência de `js-yaml` (hoje vendorizado). Verificar se o harness já tem YAML antes de duplicar.
- Hook local e agente de documentação: só testados em um commit real; falta cobrir o caso de erro.
- Sem versionamento de `doc/` e `tools/`, qualquer mudança no gate não é auditável.

## 6. Próximo passo

Executar a **Fase 0** do plano (baseline congelado do gate atual e testes com defeito provocado). É a rede de segurança para a extração e leva meio dia.
