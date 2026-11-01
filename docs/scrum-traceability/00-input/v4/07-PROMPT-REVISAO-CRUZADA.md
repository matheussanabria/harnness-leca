# Instrução ao agente integrado — Review cruzado Harness Scrum × DAI

## Modo de trabalho

**Somente inspeção e planejamento.** Não editar arquivos nos repositórios, não migrar banco, não criar histórias, não disparar workflows reais e não fazer commits, push ou deploy.

## Repositórios e resolução dos diretórios

**Antes de qualquer inspeção**, ler `01-CONFIGURACAO-REPOSITORIOS.md` e resolver exclusivamente os dois campos `repositories.*.path`. Validar com comandos Git somente de leitura. Os caminhos locais são a fonte primária; URLs GitHub são apenas referências de identidade e comparação. Não presumir que o repositório local está sincronizado com a origem remota. Não modificar os arquivos do repositório, inclusive documentos e arquivos de status.


- `matheussanabria/harnness-leca` (default `main` no momento da consulta).
- `matheussanabria/harness-dai` (privado; default `dev` no momento da consulta).

Registrar os SHA de commit e branch efetivamente inspecionados, incluindo eventuais alterações não commitadas (somente listar, sem revelar conteúdo sensível). Não presumir que continuam iguais. Se os caminhos não estiverem preenchidos, solicitar somente essa configuração e não executar buscas abrangentes no computador.

## Ordem de leitura

1. Ler `README.md`, `MAPA.md`, docs de Scrum, coordenação e telemetria do Harness; localizar implementação real (não confiar só nos docs).
2. Ler README, `.agents/`, `skills/orquestracao/sdlc-pipeline/SKILL.md` e manifest; `workflows/feature-delivery` e `workflows/product-delivery`; `docs/SDLC_PIPELINE_DESIGN.md`; `docs/architecture/00-metamodelo.md`; validações em `scripts/validate_workflow.py` do DAI.
3. Confrontar cada afirmação deste pacote com código e testes; classificar **Confirmado / Documentado mas não confirmado / Proposto / Incompatível**.
4. Produzir matrizes `Reutilizar / Adaptar / Criar / Descartar`, papéis e responsabilidades, estados e fluxo end-to-end.
5. Examinar como adaptar três variantes reais: feature padrão, tarefa UI/design e hotfix; incluir casos de múltiplos agentes, falha, retry e execução órfã.
6. Definir contratos de IDs, eventos e aceites; explicar fontes de verdade, consistência, isolamento por projeto e privacidade.
7. Propor spike read-only e MVP mínimo com histórias pequenas, critérios e testes, sem implementar.

## Entregáveis obrigatórios

- Diagnóstico com referências verificáveis a caminho, linha/trecho e commit.
- Diagrama **AS-IS** dos dois projetos e **TO-BE** de integração.
- Matriz de responsabilidades Scrum / DAI / runtime.
- Contratos JSON/TS sugeridos e mapeamento para schemas reais.
- Matriz de transições e Quality Gates; autenticação/autorização e confirmação de risco.
- Estratégia de idempotência, concorrência, retrocompatibilidade, migração e rollback.
- Backlog fatiado em entregas testáveis, com dependências e riscos.
- Recomendação de um MVP e critérios de pronto.

## Perguntas que devem ser respondidas

1. Qual funcionalidade Scrum já está realmente implementada? Quais endpoints e artefatos persistidos?
2. Qual caminho executa `feature-delivery` no DAI hoje e qual parte é apenas draft?
3. Como uma demanda vira story e como a story é comprometida com sprint sem perda de histórico?
4. O que impede dois agentes de modificarem a mesma história de forma concorrente?
5. Como garantir que evidências e Quality Gates não sejam declarações falsas dos agentes?
6. Como suportar múltiplos motores sem duplicar definição de especialistas?
7. Quais mudanças são absolutamente necessárias para o MVP sem refatoração ampla?

## Critério de saída

Encerrar com proposta de decisão arquitetural, nível de confiança, lista de incógnitas, riscos bloqueantes e instruções concretas para um PR futuro. Nenhuma modificação de código neste trabalho.
