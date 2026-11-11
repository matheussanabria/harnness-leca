# Diagramas do gate de rastreio

Data: 10/11/2026 · Contexto em [00-resumo-executivo.md](00-resumo-executivo.md) e [01-plano-execucao.md](01-plano-execucao.md).

Cada bloco abaixo é um diagrama Mermaid independente, no formato aceito pelo canvas de Quadros (flowchart e sequenceDiagram, sem cercas dentro do conteúdo colado). Para inserir: copie só o texto entre as cercas, ou peça no chat do canvas "crie este diagrama" colando o bloco.

## 1. Plano em fases e decisões

Situação em 10/11/2026: fases 0 e 1 prontas (a 1 ainda sem commit); as decisões D1 a D4 já foram respondidas.

```mermaid
flowchart TD
  A["Gate legado em saude/dispensacao: rastreio.mjs, 271 linhas, caminhos fixos"] --> F0
  F0["Fase 0 CONCLUIDA: baseline das 22 funcionalidades e testes G1 a G9"] --> F1
  F1["Fase 1 CONCLUIDA: extração para tools/rastreio, saída idêntica ao legado"] --> F2
  F2["Fase 2: configuração por projeto e projeto de fixtures com outra stack"] --> F3
  F3["Fase 3: audit-layers-drift passa a ler testes e G9"] --> F4
  F4["Fase 4: skills de adoção e migração, layer-map-exporter, workflow gate-local"] --> F5
  F5["Fase 5: versionar doc e tools do projeto e ligar o CI"]
  D1["D1: config em projects/slug/rastreio.config.json"] --> F2
  D2["D2: wrapper fino no projeto chama o harness"] --> F2
  D3["D3: doc-gate separado, vive no gate-local"] --> F4
  D4["D4: versionar doc e tools no repositório do projeto"] --> F5
```

## 2. Arquitetura do gate novo (tools/rastreio)

O gate lê os arquivos do projeto, monta um contexto (configuração e índices) e passa esse contexto para cada grupo de gates. Nenhum gate lê caminho fixo.

```mermaid
flowchart LR
  Y["rastreio.yml"] --> V
  R["regras.md"] --> V
  M["mapa-camadas.json"] --> V
  S["_status.md"] --> V
  J["Testes JUnit"] --> AJ["adapters/junit"]
  K["Specs Karma"] --> AK["adapters/karma"]
  P["Coleções Postman"] --> AP["adapters/postman"]
  CLI["cli.mjs: argumentos, saída e código de retorno"] --> CFG["config.mjs: caminhos, nomes e prefixos"]
  CLI --> CAR["carrega.mjs: monta o contexto"]
  CFG --> CAR
  AJ --> CAR
  AK --> CAR
  AP --> CAR
  CAR --> V["verifica.mjs: roda os gates na ordem do legado"]
  V --> G1["entradas: G1 sem prova, G3 elo, G4 inexistente"]
  V --> G2["regras: G2 sem código ou prova, G3 regras.md, G4 código"]
  V --> G7["g7: G7 id reaproveitado"]
  V --> G8["status: G8 contagem velha, G5 placeholder"]
  V --> G9["g9: mapa em camadas contra rastreio"]
  V --> G6["g6: G6 teste sem elo"]
  G1 --> OUT["Saída: texto ou JSON, código 1 se houver erro"]
  G2 --> OUT
  G7 --> OUT
  G8 --> OUT
  G9 --> OUT
  G6 --> OUT
```

## 3. Uso no dia a dia (pre-commit e CI)

Modelo alvo depois das fases 2, 4 e 5. O agente de documentação fica fora do gate (D3).

```mermaid
sequenceDiagram
  participant Dev as Pessoa desenvolvedora
  participant Hook as Pre-commit do projeto
  participant Wrap as Wrapper doc-features
  participant Gate as Harness tools/rastreio
  participant Doc as Workflow gate-local
  participant CI as CI do repositório
  Dev->>Hook: git commit
  Hook->>Wrap: roda o rastreio
  Wrap->>Gate: node cli.mjs com a configuração do projeto
  Gate-->>Wrap: erros e avisos por funcionalidade
  Wrap-->>Hook: código 0 ou 1
  Hook-->>Dev: barra o commit se houver erro
  Hook->>Doc: dossiê mais velho que o código?
  Doc-->>Dev: agente de documentação atualiza só doc
  Dev->>CI: push
  CI->>Gate: roda o mesmo gate
  Gate-->>CI: falha o job se houver erro
```

## 4. Como o gate foi validado (fases 0 e 1)

```mermaid
flowchart TD
  L["Gate legado: rastreio.mjs"] --> B["Baseline congelado: 22 funcionalidades, JSON"]
  L --> T["20 testes: 1 baseline e 19 com defeito provocado G1 a G9"]
  N["Gate novo: tools/rastreio"] --> C{"Saída idêntica ao baseline?"}
  B --> C
  C -->|sim, texto e JSON| OK["Extração aceita"]
  C -->|não| X["Corrigir o módulo e repetir"]
  T --> E{"Testes passam nos dois executores?"}
  N --> E
  L --> E
  E -->|20 de 20| OK
  E -->|falha| X
```
