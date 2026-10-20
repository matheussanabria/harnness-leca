# Roadmap, riscos e aceite

| Fase | Saída | Dependência | Complexidade / incerteza |
|---|---|---|---|
| 0 | Auditoria e plano | nenhuma | M / capturas ausentes |
| 1 | Tokens, schemas e caracterização | F0 | M |
| 2 | Chat modal/Studio/widget | F1 | XL / concorrência |
| 3 | SplitPanel e Studio responsivo | F2 | L |
| 4 | Workflow JSON e ensaio de migração | F1 | XL / Produto |
| 5 | Kanban e backlog | F4 | XL |
| 6 | Mapa fiel/rastreável | F1 + referências | L |
| 7 | Componentes/auditoria | F1 | L |
| 8 | Agentes/skills | F4 + orquestração | XL / segurança |
| 9 | Hardening/rollout | anteriores | L |

F1 pode preparar contratos em paralelo; implementação paralela só após aprovação dos contratos.

| Risco | Mitigação | Rollback |
|---|---|---|
| Perda de conversa | caracterização e adapter | flag por layout |
| Quebra de Scrum | versão, backup, escrita atômica | backup/leitor antigo |
| Execução duplicada | idempotência e estados | desativar gatilhos |
| Escalada de permissão | backend e aprovação | bloquear política |
| Regressão visual | baseline por estado | stylesheet anterior |
| CSS global | tokens/módulos | import anterior |
| Concorrência JSON | revisão/ETag ou lock | rejeitar conflito |

## Aceite global

- Sem segundo sistema de chat.
- Operação mutável valida projeto, permissão e versão.
- Estado/histórico consistente após falha e reload.
- Fluxos essenciais por teclado/leitor de tela.
- Seis larguras sem corte crítico.
- Migration idempotente e rollback ensaiado.
- Testes distinguem planejado, gerado, executado e aprovado.
- Sem segredos/PII não autorizada em logs e artefatos.
- Gates e demonstração reproduzível por fase.

Go da primeira implementação só após contratos de chat, baseline dos layouts e decisão de concorrência. Capturas são obrigatórias para o Mapa; Kanban não entra na primeira vertical.

