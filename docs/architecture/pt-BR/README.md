# Arquitetura do harness

Como o harness funciona de ponta a ponta:
- como o chat recebe contexto em cada tela;
- onde fica a configuração de cada projeto;
- como uma funcionalidade é entregue e como a entrega é validada.

Cada página descreve o que existe hoje, com referências aos arquivos, depois as lacunas e uma proposta. Retrato de
2026-11-13. Versão original em inglês: [../README.md](../README.md).

| Página | Responde |
|---|---|
| [01-contexto-do-chat-por-superficie.md](01-contexto-do-chat-por-superficie.md) | Que contexto o chat carrega no dashboard, no ateliê, no mapa mental e nos diagramas. Se ele reconhece e mantém o artefato atual. Como as conversas são restauradas |
| [02-configuracao-hibrida-do-projeto.md](02-configuracao-hibrida-do-projeto.md) | Se a configuração do projeto fica no harness ou no repositório do projeto, e um padrão que atende os dois casos |
| [03-pipeline-de-entrega.md](03-pipeline-de-entrega.md) | Protótipo com o Design System, depois história, BDD, testes, código e deploy. Os agentes de cada etapa, os entregáveis rastreáveis, a documentação e como o mapa em camadas é montado |
| [04-validacao-e-gates.md](04-validacao-e-gates.md) | Gates de rastreio, a validação proposta pelo mapa mental, protótipo × código (G10-G13, Chrome) e as checagens técnicas (linters, sensores, mapa) |

## Principais lacunas

| Id | Lacuna | Página |
|---|---|---|
| G-CTX-1 | Não há um provedor de contexto comum às superfícies do chat; cada uma tem a própria ligação | 01 |
| G-CTX-2 | O agente do ateliê não recebe o perfil de design do projeto, o índice do DS nem a regra do MCP | 01 |
| G-CTX-4 | As conversas salvas perdem a superfície e o artefato; retomar não reabre o protótipo ou o quadro | 01 |
| G-CTX-7 | Não há criação do artefato inicial quando a superfície ainda não tem um | 01 |
| G-CFG-1 | Sete resolvedores do repositório e caminhos do DIS fixos no código; nenhum resolvedor único | 02 |
| G-CFG-2 | A configuração dos gates está duplicada no harness e no repositório | 02 |
| G-VAL-1 | Não há visão em mapa mental da cadeia de rastreio da funcionalidade | 04 |
| G-VAL-2 | O G13 cobre uma tela, com login manual, e não tira screenshots | 04 |
| G-VAL-3 | O item de Checkstyle da auditoria é um `PASS` fixo no código | 04 |
| G-DEL-1 | Nada verifica se a implementação usou o MCP do DS | 03 |
| G-DEL-2 | O playbook e o workflow discordam da ordem entre protótipo e modelagem | 03 |

Documentos relacionados, mais detalhados:
- [delivery/rota-curta.md](../../delivery/rota-curta.md)
- [rastreio-gate/02-diagramas.md](../../rastreio-gate/02-diagramas.md)
- [harness-gates/](../../harness-gates/)
- [scrum-traceability/](../../scrum-traceability/)
- [harness-evolution/03-decisions/](../../harness-evolution/03-decisions/), principalmente o ADR-016.
