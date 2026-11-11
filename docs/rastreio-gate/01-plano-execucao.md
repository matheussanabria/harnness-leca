# Plano de execução: gate de rastreio no harness

Data: 10/11/2026 · Contexto e justificativa em [00-resumo-executivo.md](00-resumo-executivo.md).
Regras do harness que valem aqui: arquivo de código até 300 linhas, responsabilidade única, sem emojis, memória só via `node tools/memory.js save`, nada de segredos, destrutivo só com confirmação.

## 0. Estado de partida (para retomar sem o histórico)

**Origem do gate:** `C:/Users/matheuss.rodrigues/git/saude/dispensacao/tools/doc-features/` (não é git).

| Arquivo | Linhas | Papel |
|---|---|---|
| `rastreio.mjs` | 271 | Gates G1 a G9; lê `rastreio.yml`, `regras.md`, `mapa-camadas.json`, `_status.md` |
| `cobertura.mjs` | 210 | Portão de cobertura: arquivo sem dono, duplicado, cabeçalho inválido |
| `doc-gate.mjs` | 214 | Pre-commit: dossiê mais velho que o código aciona `documentation-engineer` |
| `executar.mjs`, `commits.mjs`, `defasagem.mjs`, `lib.mjs` | 160, 137, 55, 49 | Apoio |
| `vendor/js-yaml.mjs` | n/a | YAML vendorizado |

**Acoplamentos ao projeto a remover do código** (em `rastreio.mjs`, objeto `P` e funções de índice):
- Caminhos fixos: `doc/sistema/features`, `doc/postman`, `dispensacao-novo/dispensacao-api/src/{main,test}/java/br/com/procempa/saude/dispensacao`, `dispensacao-novo/dispensacao-web/src/app`.
- Convenções de referência: `Classe#método` (JUnit), `arquivo.spec.ts#título` e `#describe:Nome` (Karma), prefixo `web:` para código do front, `..` permitido.
- Nomes de arquivo: `rastreio.yml`, `regras.md`, `mapa-camadas.json`, `_status.md`, linha "Rastreabilidade (piloto)" (G8).
- Prefixo de ids `RN-<slug>-nnn` e placeholder `DIS-NOVA-*` (G5).

**Gates (G1 a G9):** ver `saude/dispensacao/doc/sistema/features/_contrato-rastreio.md` seção 6. Resumo: G1 entrada sem prova, G2 regra sem código ou prova, G3 elo quebrado, G4 artefato inexistente, G5 placeholder, G6 teste sem elo (aviso), G7 id reaproveitado, G8 contagem velha no `_status.md` (aviso), G9 mapa em camadas ↔ rastreio. Campos de extensão do G9: `rn` (nas regras do mapa), `sem_mapa: {motivo, em}` e `sem_rn` (no rastreio/mapa).

**Linha de base a preservar:** `node tools/doc-features/rastreio.mjs` nas 22 funcionalidades sai com código 0 e nenhuma linha `ERRO` ou `aviso`.

## Fase 0: rede de segurança (meio dia)

1. Congelar a saída atual: `node tools/doc-features/rastreio.mjs --json > baseline.json` (22 funcionalidades) em `tests/fixtures/rastreio/saude-dispensacao-baseline.json` do harness.
2. Escrever **testes com defeito provocado**, um por gate (G1 a G9), que copiam um `rastreio.yml` mínimo, quebram uma coisa e esperam o erro certo. Já foram provados à mão: id descontinuado reusado, prefixo de RN errado, RN em duas funcionalidades, contagem velha, `sem_mapa` apontando para mapa que não cita a RN.
3. Critério de saída: os testes rodam contra o gate **atual** e passam.

## Fase 1: extração modular (1 a 2 dias)

Destino: `harness-leca/tools/rastreio/`.

```
tools/rastreio/
  cli.js                 argumentos, saída, código de retorno (<=150 linhas)
  config.js              lê e valida rastreio.config.json
  carrega.js             lê rastreio.yml, regras.md, mapa, _status.md
  gates/g1-g2.js ... g9.js   um arquivo por grupo de gates, cada um <=300 linhas
  adapters/junit.js      índice de testes Java e Classe#método
  adapters/karma.js      índice de specs e títulos de it/describe
  adapters/postman.js    índice de requests
  adapters/codigo.js     existência de arquivo de código (api/web)
```

Regras da extração:
- Mover primeiro sem mudar comportamento; só depois parametrizar.
- Gates recebem um objeto de contexto (config + índices), sem ler caminho fixo.
- `js-yaml`: verificar `package.json` do harness; usar a dependência existente ou vendorizar uma vez.
- Critério de saída: a saída `--json` do gate novo, rodando contra o saude-dispensacao, é **idêntica** ao `baseline.json` e os testes da fase 0 passam.

## Fase 2: configuração por projeto (1 dia)

Esquema proposto de `projects/<slug>/rastreio.config.json`:

```json
{
  "docs": { "features": "doc/sistema/features", "postman": "doc/postman" },
  "ids": { "regra": "RN", "placeholder": "DIS-NOVA-" },
  "arquivos": { "rastreio": "rastreio.yml", "regras": "regras.md", "mapa": "mapa-camadas.json", "status": "_status.md" },
  "stacks": [
    { "tipo": "junit", "raizMain": "dispensacao-novo/dispensacao-api/src/main/java/...", "raizTest": "dispensacao-novo/dispensacao-api/src/test/java/..." },
    { "tipo": "karma", "raiz": "dispensacao-novo/dispensacao-web/src/app", "prefixo": "web:" }
  ]
}
```

Tarefas:
1. Escrever o config do saude-dispensacao e rodar o gate pelo harness: baseline idêntico.
2. Criar um **projeto de fixtures** pequeno (2 funcionalidades, 1 stack diferente, por exemplo TypeScript com Jest ou Python com pytest) para provar a portabilidade. Se a stack nova exigir adaptador, implementá-lo.
3. Validar o config com mensagem clara (campo ausente, caminho inexistente).
4. Wrapper em `saude/dispensacao/tools/doc-features/rastreio.mjs` que chama o harness com o config (decisão D2 do resumo). O pre-commit local continua funcionando.

## Fase 3: ferramentas que leem o rastreio (1 dia)

1. `tools/audit-layers-drift.js`: parar de devolver `testes: 0`; ler `testes.grupos` e contar por `st`; cruzar `rn` com o rastreio; reportar o G9. Teste de unidade.
2. UI de camadas (`ui/.../design-layers`): exibir a situação do G9 por funcionalidade (RN sem regra no mapa, regra sem `rn`), se o painel já tiver onde mostrar. Opcional.

## Fase 4: skills e workflow (1 a 2 dias)

| Entregável | Tipo | Conteúdo |
|---|---|---|
| `rastreio-adocao` | Skill | Criar o config, a pasta de features, o `rastreio.yml` e `regras.md` a partir de BDD e testes existentes; rodar o gate |
| `rastreio-migrar-feature` | Skill | Checklist por funcionalidade; ressalva obrigatória "regras escritas do dossiê, não relidas no código"; fan-out opcional em subagentes Haiku com briefing e aplicador de `rn` (modelo usado em 10/11/2026) |
| `layer-map-exporter` (atualizar) | Skill | Entrada passa a ser o `rastreio.yml`; schema ganha `rn`, `sem_mapa`, `sem_rn`; regra de situação de teste sincronizada com G9 |
| `gate-local` | Workflow | Pre-commit: gate, cobertura e, se dossiê desatualizado, agente de documentação (D3: separado do gate) |

Lições a registrar nas skills (medidas em 10/11/2026):
- Subagentes Haiku ligaram mapa a RN com custo baixo (85 a 114 mil tokens, 2 a 3 minutos cada) e relataram as dúvidas em vez de inventar. Valor: leitura e correspondência. Limite: a mudança de situação (`st`) exige evidência no código e fica com quem tem contexto.
- Todo achado de "mapa diz X, RN diz Y" foi conferido no código antes de corrigir; 6 de 6 vezes o mapa estava defasado.
- Aplicador que só insere o campo `rn`, com backup, evitou reformatar os JSON.

## Fase 5: versionamento e CI (depende de D4)

1. Decidir onde versionar `doc/` e `tools/` do projeto.
2. Com isso versionado: job de CI que roda `harness rastreio` e falha em erro.
3. Registrar o resultado no registro de execução do projeto.

## Critérios de aceite do conjunto

- O gate roda em um projeto que não é o saude-dispensacao, só com configuração (e adaptador, se a stack for nova).
- A saída do saude-dispensacao pelo harness é idêntica à linha de base.
- Os testes de defeito provocado cobrem G1 a G9.
- `audit-layers-drift.js` reporta testes e G9 corretamente.
- As skills novas passam pelo `skill-architect`/`validation` do harness (checklist e casos de teste).

## Riscos

| Risco | Mitigação |
|---|---|
| Regressão silenciosa na extração | Baseline idêntico e testes de defeito provocado como porta de cada fase |
| Config virando segunda fonte de verdade | Validar o config e falhar cedo; documentar um exemplo mínimo |
| Gate acoplado a Java/Karma | Adaptadores com interface única; projeto de fixtures com outra stack |
| Agente de documentação no hook gera mudança indevida | Já limitado a escrever só em `doc/` e barrar se mexer em código ou no stage; testar o caso de erro |
| Falsa sensação de verdade (G9 não prova o vínculo) | Dizer isso na skill de migração e no relatório do gate |

## Como retomar

1. Ler este plano e o resumo.
2. Conferir a linha de base: no saude-dispensacao, `node tools/doc-features/rastreio.mjs; echo $?` deve dar 0 sem avisos.
3. Começar pela Fase 0. Em seguida, pedir decisão de D1 a D4 antes da Fase 2.
4. Registrar fatos duráveis com `node tools/memory.js save --scope project --project saude-dispensacao ...`.
