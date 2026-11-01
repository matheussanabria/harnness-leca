# Harness Scrum + DAI — Pacote v4 para revisão local

**Escopo:** revisão arquitetural read-only. Conteúdo arquitetural da v3 preservado. A v4 acrescenta configuração dos caminhos locais e regras de inspeção dos dois workspaces, sem alterar o escopo de revisão read-only.

## Ordem

1. `00-LEIA-PRIMEIRO.md`
2. `01-CONFIGURACAO-REPOSITORIOS.md` (preencher os dois caminhos antes da revisão)
3. `CONTEXTO-SCRUM-TRACEABILITY.md`
4. `03-CONTEXTO-DELIVERY-ORCHESTRATOR.md`
5. `06-INTEGRACAO-SCRUM-DAI.md`
6. `PLANO-REVISAO-SCRUM-TRACEABILITY.md`
7. `04-PLANO-REVISAO-DELIVERY-ORCHESTRATOR.md`
8. `05-ROTEIRO-ANALISE-DAI.md`
9. `07-PROMPT-REVISAO-CRUZADA.md`

## Prioridade em conflitos

Evidência do código e testes no commit efetivamente inspecionado > documentos atuais dos repositórios > adendo v3 > hipóteses dos documentos v2. Identificar conflitos, não corrigir silenciosamente.

## Premissas abertas

O README do DAI identifica agentes e skills e o fluxo `sdlc-pipeline`, mas essa consulta não validou seus efeitos em runtime nem a compatibilidade com o Scrum atual. O plano deve tratar isso como discovery, não como implementação autorizada.

## Como iniciar

1. Extraia o ZIP em uma pasta acessível ao agente.
2. Edite somente os campos `path` de `01-CONFIGURACAO-REPOSITORIOS.md`.
3. Solicite ao agente: **"Leia `00-LEIA-PRIMEIRO.md` e siga `07-PROMPT-REVISAO-CRUZADA.md`, utilizando `01-CONFIGURACAO-REPOSITORIOS.md` para acessar os repositórios locais. Faça apenas discovery read-only."**
