# Harness — Telemetria de motores, agentes, skills e workflows

**Resumo executivo, pré-plano e briefing para planejamento com Claude**  
**Data:** 23/10/2026 · **Versão:** 0.1  
**Status:** proposta para aprofundamento; não constitui arquitetura aprovada nem implementação concluída.

## 1. Resumo executivo

O Harness precisa consolidar a observabilidade das atividades de desenvolvimento com IA: sessões simultâneas de Claude Code, Codex, Gemini CLI e OpenCode, agentes orquestrados entre motores, consumo de tokens, custos, interações, ferramentas, skills e workflows.

Hoje, a necessidade vai além de saber se um motor está ativo. É preciso identificar cada sessão e execução, sua atividade atual, quem a iniciou, quais recursos utilizou e qual consumo efetivamente foi observado. Uma sessão pode permanecer aberta sem trabalhar; um agente pode aguardar aprovação; um coordenador pode iniciar agentes em outros motores.

**Resultado esperado:** uma central que permita navegar da tarefa ao workflow, às etapas, aos agentes, às aplicações de skills e às chamadas que explicam o consumo. O escritório 3D e os painéis convencionais devem apresentar os mesmos dados canônicos.

**Direção recomendada:** evoluir a base existente com adaptadores por motor, registro persistente de sessões e execuções, eventos normalizados, correlação de orquestrações e agregações incrementais. Preservar a operação local e medir o custo de recursos da própria telemetria.

**Benefícios:** localizar gargalos e aprovações pendentes; evitar perder sessões simultâneas; explicar consumo por projeto e tarefa; comparar versões de workflows e skills; investigar falhas e retrabalho com evidências.

**Limite central:** observabilidade não implica controle universal. Descobrir uma sessão não garante que seja possível enviar mensagens, cancelar trabalho ou reconstruir sua orquestração. Cada adaptador deve declarar suas capacidades e limitações.

## 2. Escopo e perguntas que o produto deve responder

| Área | Perguntas |
| --- | --- |
| Atividade | Quais sessões estão conectadas? Quais executam, aguardam ou estão ociosas? |
| Orquestração | Quem iniciou cada agente? Qual tarefa e etapa ele atende? |
| Consumo | Quantos tokens e chamadas foram registrados? Qual parcela está sem dados? |
| Custos | Qual valor é estimado, informado pela fonte ou confirmado por cobrança? |
| Skills | Quais foram descobertas, carregadas e aplicadas? Em qual versão? |
| Workflows | Qual etapa está em andamento? Onde houve espera, falha ou repetição? |
| Efetividade | A execução passou pelas validações definidas? Houve retrabalho? |

O escopo inclui sessões iniciadas pelo Harness e sessões externas, conforme capacidade comprovada de observação. O MVP não promete captura universal, recuperação de dados históricos inexistentes, cobrança exata de assinaturas, inferência perfeita de atividade ou controle remoto de qualquer sessão.

## 3. Base observada no repositório

Repositório de referência: https://github.com/matheussanabria/harnness-leca

Os arquivos abaixo foram lidos na conversa que originou este documento. A leitura foi parcial, na branch padrão; não foi uma auditoria completa e nenhum código foi alterado. Claude deve fixar o commit da próxima análise e revalidar as conclusões.

| Arquivo | Observação | Implicação a validar |
| --- | --- | --- |
| `tools/lib/hia/telemetry.js` | Registra execuções, duração e tokens em JSONL; consolida algumas métricas por executor | Reaproveitar o registro, definindo correlação e semântica de consumo |
| `tools/lib/runtime/telemetry.js` | Registra inferências, tokens, tempos e `correlationId`; campos numéricos ausentes podem virar zero | Distinguir zero medido de dado indisponível; compatibilizar contratos |
| `ui/public/js/modules/chat-execution-store.js` | Mantém execuções por projeto/conversa em memória no navegador; notifica assinantes com `slug` e `chatId` | Reutilizar identidade existente; não depender do navegador para observação persistente |
| `ui/public/js/office/office-agent-telemetry.js` | Atualiza o estado por motor e atribui `activeCount` como 0 ou 1 a partir de uma execução | Há risco de uma sessão sobrescrever o estado de outra do mesmo motor; reproduzir antes de corrigir |

Os leitores de JSONL inspecionados carregam o arquivo completo para consolidar métricas. Avaliar impacto com crescimento do histórico. Verificar também o tratamento de linhas inválidas, pois a quantidade de linhas não equivale necessariamente à quantidade de registros válidos.

## 4. Modelo conceitual proposto

| Entidade | Responsabilidade |
| --- | --- |
| Projeto / tarefa | Contexto do trabalho e resultado esperado |
| Motor / instância | Ferramenta de execução e sua instância em um host |
| Provedor / modelo | Serviço que atende cada chamada e modelo efetivo utilizado |
| Sessão | Conversa persistente, passível de retomada |
| Agente | Identidade ou papel; não presumir equivalência com processo ou sessão |
| Execução | Trabalho ou turno individual, com resultado e relações causais |
| Workflow / execução | Definição versionada e uma execução concreta dela |
| Etapa / tentativa | Unidade de trabalho, dependências e reexecuções |
| Skill / aplicação | Definição versionada e uso observado ou explicitamente instrumentado |
| Chamada | Requisição ao modelo ou invocação de ferramenta |
| Observação de uso | Evidência de tokens/custo, origem, qualidade e semântica |

Identificadores candidatos: `projectId`, `taskId`, `hostId`, `engineInstanceId`, `sessionId`, `nativeSessionId`, `agentId`, `runId`, `parentRunId`, `traceId`, `workflowRunId`, `stepRunId`, `attemptId`, `skillApplicationId` e `callId`.

São nomes propostos para o Harness, não APIs nativas presumidas. A identidade nativa deve ser contextualizada por motor/instância para evitar colisões. Uma sessão pode conter várias execuções; uma chamada pode se associar a várias skills. Modelar associações sem replicar registros financeiros.

Relações de delegação formam uma hierarquia inicial, mas dependências entre etapas, retomadas e colaboração podem exigir ligações adicionais. Não forçar toda causalidade em uma árvore única.

## 5. Coleta e correlação

Priorizar eventos estruturados e interfaces documentadas. Usar logs locais como fallback versionado e descoberta de processos como evidência complementar de presença, nunca como prova isolada de trabalho.

| Motor | Caminho identificado na consulta anterior | Validação necessária |
| --- | --- | --- |
| Claude Code | OpenTelemetry para uso, custos e atividade de ferramentas | Versão instalada, configuração, atributos e cobertura de subagentes |
| Codex | OpenTelemetry com eventos de conversa, chamadas e ferramentas; tokens em eventos de conclusão | Campos efetivos, transporte, autenticação e cobertura por interface |
| Gemini CLI | OpenTelemetry e opções de coleta local | Eventos disponíveis, configuração e cobertura de sessões |
| OpenCode | API de sessões/status/filhos, eventos e plugins | Instâncias acessíveis, esquema de mensagens/uso e relações nativas |

Quando o Harness iniciar uma execução filha, registrar a relação causal antes do disparo e transportar a correlação pelo mecanismo suportado. Não assumir que todos os motores propagam automaticamente um contexto OpenTelemetry recebido.

Para execuções externas, usar relação nativa comprovada ou instrumentação explícita. Coincidência de diretório, PID pai ou horário pode ajudar uma investigação, mas não comprova a relação lógica de agentes. Relações incertas devem ser marcadas como inferidas ou desconhecidas.

Manter separadas:

- **Conexão/presença:** conectada, sem sinal recente, encerrada ou desconhecida.
- **Atividade:** ociosa, processando, executando ferramenta, aguardando aprovação, aguardando dependência, concluída, cancelada ou com erro.
- **Fase do trabalho:** planejamento, implementação, teste etc., somente quando declarada pelo workflow ou por evento confiável.

Registrar último evento de atividade e último sinal de presença separadamente. Expiração de presença não significa conclusão. A coleta deve continuar quando a interface estiver fechada.

## 6. Tokens, custos e interações

### 6.1 Regras de contabilização

1. Registrar consumo na menor unidade confiável disponível, preferencialmente a chamada, preservando a evidência nativa necessária à auditoria.
2. Agregações por agente, workflow e tarefa devem usar chamadas únicas. Não somar totais agregados dos pais novamente aos filhos.
3. Diferenciar eventos incrementais, acumulados e atualizações de uma mesma chamada; tratar reinícios de contador, reenvios e importações repetidas.
4. Não somar cache ou raciocínio novamente quando já incluídos em outro contador. Definir mapeamento por provedor e versão.
5. Ausência de dado é `null`/indisponível; zero exige observação válida. Estimativas devem ter método e qualidade registrados.
6. Separar turnos humanos, requisições ao modelo, tentativas, ferramentas e mensagens entre agentes. Evitar um contador ambíguo de “interações”.
7. Registrar modelo/provedor por chamada, pois podem mudar durante a sessão.
8. Tratar cobertura como métrica: denominador e universo observado explícitos; se o total de chamadas for desconhecido, não exibir uma porcentagem artificialmente precisa.

### 6.2 Semântica financeira

- **Estimado:** calculado com tabela de preços versionada, moeda, data de vigência e método de cálculo.
- **Informado:** valor emitido pela fonte; pode também ser uma estimativa e não equivale necessariamente à fatura.
- **Faturado:** confirmado por uma fonte de cobrança com escopo e possibilidade de reconciliação conhecidos.

Não converter consumo de assinatura automaticamente em cobrança por token. Um equivalente pela tabela de API deve ter esse rótulo. Conversão para reais deve informar taxa e data. Tratar custo de ferramentas separadamente quando existir; preços e precisão monetária precisam de decisão explícita.

## 7. Telemetria de skills

Eventos candidatos: `skill.discovered`, `skill.selected`, `skill.loaded`, `skill.application.started`, `skill.application.completed` e `skill.application.failed`.

**Descoberta não é aplicação. Leitura não comprova execução das instruções.** Registrar evidência e origem: usuário, workflow, agente ou inferência. Não depender exclusivamente de autorrelato do modelo para comprovar sucesso.

Por skill: identificador, versão/hash, origem, recursos carregados, aplicações vinculadas, duração associada, ferramentas, resultados de validação e retrabalho observado.

| Medida | Interpretação |
| --- | --- |
| Volume carregado | Tokens estimados das instruções e recursos; declarar tokenizer/método |
| Consumo associado | Uso das chamadas vinculadas à aplicação; pode se sobrepor ao de outras skills |
| Custo atribuído | Parcela distribuída por uma regra explícita e versionada |
| Impacto incremental | Diferença avaliada em comparação controlada com e sem a skill |

Tokens do arquivo não equivalem automaticamente a tokens adicionais faturados: cache, reutilização de contexto e compactação interferem. Se uma chamada usar duas skills, ela entra uma única vez no total financeiro. Painéis de associação devem avisar que suas linhas podem se sobrepor. Rateio e experimentos de impacto ficam fora do MVP, salvo justificativa de prioridade.

## 8. Telemetria de workflows

Versionar a definição e registrar cada execução, etapa e tentativa. Eventos candidatos: início/fim de workflow, início/fim/falha/espera/repetição de etapa e delegação de execução.

Registrar dependências, paralelismo, entradas/saídas como referências, resultado das validações, artefatos, agentes envolvidos, skills e consumo associado. Evitar copiar conteúdos sensíveis para a telemetria.

Métricas principais: duração de parede, tempo executando, espera por aprovação/dependência, número de tentativas, etapas ignoradas/canceladas, resultado e consumo por etapa. Em paralelo, a soma dos tempos dos agentes pode exceder a duração total; apresentar ambas com nomes claros.

“Concluído” é um estado de execução; “validado” exige critério de aceite e evidência. Comparações de eficiência devem considerar tipo/complexidade de tarefa, modelo e versão; menor consumo isoladamente não significa melhor resultado.

## 9. Arquitetura candidata e experiência

Fluxo proposto: adaptadores → normalização/deduplicação → persistência e projeções de estado → API/eventos para a interface. A árvore de orquestração, o painel e o escritório usam a mesma fonte canônica.

| Alternativa | Vantagem | Limitação |
| --- | --- | --- |
| Importação de logs | Histórico com menor esforço inicial | Atividade ao vivo e causalidade limitadas |
| Adaptadores + serviço local + armazenamento consultável | Integração direta com o Harness e controle de recursos | Contratos, migrações e manutenção por motor |
| Plataforma completa de observabilidade | Ferramentas amplas para operação distribuída | Mais componentes, recursos e complexidade operacional |

Recomendação preliminar: segunda alternativa. Reutilizar o backend e o transporte existentes quando adequados. SQLite e SSE são candidatos, não decisões fechadas. Avaliar um receptor/collector OTLP compatível para fontes OpenTelemetry; não confundir endpoint JSON próprio com suporte completo a OTLP.

Prever fila limitada, retomada após falha, retenção/rotação, deduplicação persistente e reprocessamento compatível. Falha da telemetria não deve derrubar o trabalho do agente; a perda de eventos deve ser visível.

Visões previstas:

- **Agora:** sessões agrupadas por projeto/motor, estado, última atividade e acesso à conversa quando suportado.
- **Orquestrações:** relações causais, dependências e linha do tempo.
- **Consumo:** tokens, custos, duração, cache, erros e cobertura por período/projeto/modelo.
- **Skills:** uso por versão, carregamentos, aplicações confirmadas e resultados.
- **Workflows:** execuções, etapas, gargalos, tentativas e distribuição de consumo.

No escritório 3D, mostrar contagens como “3 executando · 2 aguardando”, com acesso à lista filtrada. Estados detalhados não devem ser substituídos por uma única atualização de motor.

## 10. Pré-plano de implementação

| Fase | Entrega | Dependências | Critério de saída |
| --- | --- | --- | --- |
| P0 — Diagnóstico | Inventário real, versões, fontes, contratos, riscos e ADRs | Acesso ao código e configurações sem segredos | Matriz de capacidades com evidência; reproduzir problema de simultaneidade |
| P1 — Fundação | Contrato versionado, identidades, relações, persistência e deduplicação | P0 | Replay não duplica; ausência não vira zero; hooks para skills/workflows previstos |
| P2 — Atividade | Registro de sessões, projeção no backend, correção da agregação e tela Agora | P1 | Duas sessões do mesmo motor permanecem independentes; UI fechada não interrompe coleta |
| P3 — Motores e consumo | Adaptadores graduais, tokens normalizados, preços e qualidade dos dados | P1; integra com P2 | Cobertura explícita por motor; totais conferidos com fixtures e dados reais sanitizados |
| P4 — Orquestração, skills e workflows | Instrumentação de execução, etapas, aplicações e relações entre motores | P1 e pontos de integração confirmados | Cadeia entre motores rastreável; múltiplas skills não duplicam custos |
| P5 — Visões e operação | Painéis completos, retenção, alertas e controle de acesso | P2–P4 | Estado consistente entre telas; orçamento de recursos medido |

**MVP sugerido:** fundação comum; sessões internas individualizadas; primeiro adaptador externo escolhido por cobertura comprovada; consumo por chamada onde disponível; instrumentação de um workflow real com suas skills. Expandir para os quatro motores de forma incremental e visível. Não deixar identidade/versionamento de skills e workflows para uma migração tardia.

A primeira correção de UI pode ser isolada se o diagnóstico comprovar baixo acoplamento. Claude deve definir sequência final, tamanho dos incrementos e estimativas somente após inspecionar o código.

## 11. Testes e aceitação

| Cenário | Resultado esperado |
| --- | --- |
| Duas sessões Claude; uma termina | A outra continua visível e ativa; contagem correta |
| Coordenador chama Codex, que delega OpenCode | Relações explícitas; custo total por chamadas únicas |
| Sessão externa sem correlação | Visível conforme cobertura, sem inventar parentesco |
| Coletor reinicia ou importa o histórico novamente | Sem duplicação; cursores/checkpoints consistentes |
| Eventos atrasados ou fora de ordem | Sem regressão indevida de estado; reconciliação determinística |
| Streaming seguido de total final | Atualizações não somadas como novas chamadas |
| Token/custo ausente | Indisponível e cobertura explícita, nunca zero presumido |
| Uma chamada utiliza duas skills | Duas associações e uma única contabilização financeira |
| Skill apenas lida | Estado carregada, sem aplicação confirmada inventada |
| Etapa repetida e etapas paralelas | Tentativas preservadas; duração real e tempo agregado distintos |
| Interface fecha ou fonte perde sinal | Coleta continua; perda de presença não vira conclusão |
| Histórico cresce ou há pico de eventos | Medir CPU, RAM, disco, latência e perdas; comparar com baseline |

Criar fixtures sanitizadas de formatos reais, testes de contrato por adaptador e testes de integração nos pontos de correlação/contabilização. Revalidar scripts do `package.json`: o README consultado anuncia `npm test` e `npm run check`, mas comandos finais devem refletir o checkout analisado. Não apresentar testes propostos como executados.

## 12. Riscos, rollout e decisões abertas

- **Dados sensíveis:** coletar metadados por padrão; sanitizar argumentos, erros e saídas. Não persistir prompts, credenciais ou dados de pacientes indiscriminadamente. Definir autenticação e autorização para ingestão e consulta, especialmente no modo remoto.
- **Sobrecarga:** evitar reler histórico completo a cada atualização; medir collector, adaptadores, projeções e interface com telemetria ligada/desligada.
- **Formatos mutáveis:** versionar adaptadores e fixtures; falha de parsing deve reduzir cobertura explicitamente, não fabricar valores.
- **Atribuição equivocada:** preservar evidência, confiança e distinção entre observado/estimado/inferido.
- **Rollout:** ativar adaptadores e novas projeções gradualmente; comparar resultados com a base existente antes da troca de leitura.
- **Rollback:** desativar a nova coleta/projeção, manter fluxo anterior operacional e preservar dados para investigação; evitar migração destrutiva no primeiro incremento.

Decisões a aprofundar: armazenamento; transporte de eventos; estratégia OTLP; instalação/configuração dos adaptadores; semântica de retomada; suporte Windows/WSL e múltiplos hosts; retenção; limites de recursos; política de custo; acesso remoto; origem das definições de skills/workflows; granularidade de aprovação e ações suportadas.

## 13. Briefing para o Claude — pronto para uso

> Atue como arquiteto e coordenador técnico do Harness. Use este documento como briefing inicial, não como descrição definitiva do código nem arquitetura já aprovada. Sua missão nesta etapa é aprofundar o planejamento e a estratégia de orquestração; não implementar nem alterar configurações dos motores automaticamente.
>
> 1. Leia as instruções aplicáveis do repositório, o mapa arquitetural e a documentação de runtime/orquestração. Identifique branch e commit analisados. Verifique os quatro arquivos citados e localize seus produtores, consumidores, rotas, testes e fontes de dados.
> 2. Classifique cada conclusão como verificada no código, documentada externamente, proposta, suposição ou pendência. Não presuma ausência de funcionalidade com base apenas nos arquivos citados.
> 3. Investigue como sessões, agentes, subprocessos, skills e workflows são identificados hoje. Localize todos os caminhos de disparo, delegação, retomada, conclusão, aprovação e cancelamento. Determine onde instrumentar sem depender do autorrelato do LLM.
> 4. Construa uma matriz por motor/versão/interface: presença, atividade, tokens, cache, raciocínio, custo, ferramentas, subagentes, skills, workflows e capacidade de controle. Marque limitações, fonte e fallback. Consulte documentação oficial atual quando necessário; não invente eventos ou APIs.
> 5. Proponha duas ou três alternativas de arquitetura, com recursos locais, manutenção, confiabilidade, privacidade e integração com o escritório. Registre ADRs para armazenamento, ingestão, correlação, deduplicação, estado e contabilização.
> 6. Especifique contratos de eventos e entidades, timestamps de ocorrência/ingestão, chaves de idempotência, versionamento, eventos atrasados, acumulados versus deltas, retomadas e relações entre motores. Preserve a distinção entre associação de skills e atribuição aditiva de custo.
> 7. Defina o MVP e um backlog por épico/história. Para cada item: objetivo, arquivos afetados verificados, dependências, critérios de aceite, testes, rollout/rollback e estimativa com incerteza. Mantenha skills e workflows no contrato inicial.
> 8. Prepare o plano de orquestração dos agentes de implementação. Sugestão de frentes: contratos/contabilização; integrações dos motores; runtime/skills/workflows; interface/escritório; validação/performance. Ajuste a quantidade ao orçamento de RAM, tokens e ao acoplamento real. Evite um agente permanente por motor se isso aumentar custo sem benefício.
> 9. O coordenador deve consolidar decisões e contratos antes de delegar mudanças acopladas. Cada tarefa delegada precisa de escopo, entradas, saída esperada, arquivos de responsabilidade, dependências e validação. Use paralelismo apenas em frentes independentes; mudanças em schemas e interfaces compartilhadas devem ter um único responsável e integração sequenciada.
> 10. Se usar subagentes durante o diagnóstico, mantenha-os em leitura, com escopos distintos e sem repetir inspeções desnecessárias. Registre divergências e evidências; não simule delegação indisponível. Sessões paralelas devem respeitar o orçamento de recursos definido.
> 11. Entregue diagnóstico, arquitetura recomendada, ADRs, contratos propostos, matriz de capacidades, backlog ordenado, grafo de dependências, plano de delegação e validação local. Inclua propostas de commits Conventional Commits e conteúdo esperado dos PRs, sem criar commits ou PRs nesta etapa.
> 12. Liste apenas perguntas que realmente bloqueiem decisões. Para escolhas reversíveis, declare uma suposição e avance no planejamento. Encerre indicando o primeiro incremento pronto para implementar e suas dependências; não confunda proposta, teste planejado e resultado executado.

## 14. Referências para revalidação

Fontes consultadas na conversa anterior; capacidades e versões precisam ser conferidas no ambiente de implementação. Este documento não adiciona uma nova auditoria dessas fontes.

- [Repositório Harness](https://github.com/matheussanabria/harnness-leca)
- [Claude Code — Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Codex — Advanced Configuration / Observability](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [Gemini CLI — Telemetry](https://geminicli.com/docs/cli/telemetry/)
- [OpenCode — Server](https://opencode.ai/docs/server/)
- [OpenCode — Plugins](https://opencode.ai/docs/plugins/)

**Definição de pronto deste pré-plano:** contexto e escopo consolidados, hipóteses separadas das evidências, regras críticas explicitadas e briefing suficiente para Claude produzir um plano executável contra o código real.
