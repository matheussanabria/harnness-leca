# Ateliê — evolução da qualidade dos protótipos

**Projeto:** Harness / Dai  
**Data:** 24/10/2026  
**Versão:** 1.0  
**Status:** proposta para aprovação; implementação não iniciada.

## 1. Resumo executivo

Propomos evoluir o processo de prototipação do Ateliê para produzir interfaces com identidade visual, interações demonstráveis e acabamento consistente. A mudança central é estabelecer uma direção visual antes da geração e revisar o resultado renderizado antes de concluir a entrega.

O fluxo proposto é: briefing estruturado → duas alternativas da primeira dobra → seleção da direção → composição do protótipo → revisão visual e funcional → correções localizadas → entrega com evidências.

O investimento inicial deve se concentrar em um piloto reversível, utilizando o Design System e as integrações existentes. O benefício esperado é reduzir ajustes manuais e retrabalho, preservando autonomia criativa dentro das regras do projeto. Essa expectativa será validada comparando qualidade, esforço, tempo e consumo com o fluxo atual.

**Decisão solicitada:** aprovar a auditoria técnica e o escopo de um piloto controlado. A execução do piloto dependerá da confirmação de viabilidade, estimativa e limite de consumo ao final da auditoria. A adoção geral será uma decisão posterior, baseada nos resultados.

## 2. Base da proposta e limites do diagnóstico

Foram consultados os arquivos `AGENT.md` e `manifest.yaml` do UX/UI Designer compartilhados nesta conversa. Eles orientam o papel a wireframes e protótipos textuais, handoff, estados e acessibilidade; atribuem a implementação da interface ao frontend. Não explicitam exploração de alternativas visuais nem revisão obrigatória por screenshots.

Isso caracteriza uma oportunidade nos contratos consultados. Não comprova ausência dessas capacidades no Ateliê atual: repositório, skills referenciadas e integrações de execução ainda precisam ser auditados.

Premissas a preservar: o Design System do projeto prevalece; componentes devem ser reutilizáveis; processamento determinístico deve ser preferido quando suficiente; decisões aprovadas precisam persistir durante as revisões. O piloto é exclusivamente de prototipação, com dados fictícios e integrações simuladas quando necessário.

## 3. Escopo proposto

| Frente | Entrega do piloto | Resultado verificável |
|---|---|---|
| Briefing | Objetivo, público, ação principal, conteúdo, identidade, restrições, referências e suposições | O agente consegue justificar suas escolhas a partir do pedido |
| Direção visual | Duas alternativas da primeira dobra com o mesmo conteúdo | Variação real de composição, tipografia ou imagens, além da cor |
| Design System | Componentes e tokens existentes; registro de lacunas | Sem exceções locais silenciosas ou substituição do sistema do projeto |
| Conteúdo | Textos representativos e dados fictícios identificados | Layout avaliado com títulos longos, ausência de imagem e outras condições relevantes |
| Interações | Um fluxo principal navegável e estados aplicáveis | Ações produzem respostas e permitem recuperação ou retorno |
| Revisão | Capturas desktop/mobile, inspeção funcional e lista priorizada de problemas | Evidência antes/depois e justificativa de cada correção |
| Rastreabilidade | Versões, direção escolhida, componentes, revisões e medições | Possibilidade de reproduzir decisões e restaurar a versão anterior |

Ficam fora deste piloto: reconstrução integral do Ateliê, novo Design System, novo motor de renderização, paridade completa entre frameworks, backend de produção, publicação externa e uma plataforma completa de telemetria. Enriquecer todo o catálogo com miniaturas e exemplos é uma evolução posterior; no piloto, basta documentar os componentes utilizados.

## 4. Abordagem recomendada

| Alternativa | Benefício | Limitação |
|---|---|---|
| Ajustar apenas prompts | Menor esforço inicial | A verificação e a consistência continuam dependentes de execução manual |
| Workflow incremental sobre o Ateliê existente | Permite medir qualidade e custo, com reversão simples | Requer integrar captura, evidências e controle de etapas |
| Reconstruir a arquitetura de prototipação | Permite mudanças amplas | Maior escopo e risco antes de comprovar a necessidade |

Recomenda-se o workflow incremental. A auditoria deverá aproveitar capacidades existentes e identificar o menor conjunto de mudanças necessário.

## 5. Plano de execução e pontos de decisão

| Etapa | Trabalho | Entregável e condição de avanço |
|---|---|---|
| 0 — Auditoria e referência inicial | Inspecionar código, contratos, skills, consulta ao Design System, preview, inspetor e testes; executar o fluxo atual com um briefing fixo | Mapa confirmado do fluxo, lacunas, baseline, estimativa de esforço e limite de consumo proposto. Aprovar esses limites antes de executar o piloto |
| 1 — Contratos e direção | Definir briefing, registro de direção visual, divisão de responsabilidades e formato de revisão; gerar duas alternativas pequenas | Direção selecionada pelo usuário e contratos compatíveis com a arquitetura encontrada |
| 2 — Protótipo navegável | Compor uma página ou fluxo curto com componentes existentes, dados locais e estados relevantes | Preview funcional, compatibilidade preservada com edição/inspeção já suportadas e versão recuperável |
| 3 — Revisão e correção | Renderizar nos tamanhos definidos, testar interações, revisar hierarquia e acessibilidade; corrigir problemas prioritários | No máximo duas rodadas, até três problemas de maior impacto por rodada; registrar pendências |
| 4 — Comparação e decisão | Comparar fluxo atual e proposto usando o mesmo briefing e critérios | Relatório de qualidade, esforço e consumo; decisão de adotar, ajustar ou encerrar o piloto |

Responsabilidades propostas: UX/UI Designer define direção e avalia experiência; frontend implementa o protótipo; QA valida fluxos e regressões; o orquestrador conserva contexto e limites; o usuário escolhe a direção e decide a adoção. São responsabilidades, sem exigência de criar novos agentes ou executá-los simultaneamente.

## 6. Critérios de aceite

- Briefing completo, com suposições e conteúdo fictício identificados.
- Duas propostas comparáveis, com variação visual significativa e escolha registrada.
- Aderência aos componentes e tokens do projeto; extensões necessárias explicitadas.
- Fluxo principal executável com dados locais, incluindo os estados aplicáveis e indicação de simulações.
- Ausência de sobreposição, corte de conteúdo e rolagem horizontal acidental nas larguras de 360, 390, 768 e 1440 px. Verificar também paisagem mobile e navegação por teclado; ajustar a matriz se o público exigir outros dispositivos.
- Ação principal clara, tipografia legível, foco visível, rótulos compreensíveis e estrutura semântica coerente.
- Revisão do resultado renderizado, com evidências das correções. Verificações automáticas não substituem a revisão visual e de uso.
- Compatibilidade preservada com recursos existentes de preview, seleção, edição e salvamento que a auditoria confirmar como funcionais.
- Consumo e tempo registrados; dados indisponíveis devem ser marcados como indisponíveis, nunca como zero.
- Nenhum bloqueio crítico no fluxo principal. Se o limite de revisão for atingido com bloqueios, registrar o resultado como incompleto e submeter o próximo passo à decisão.

## 7. Avaliação de qualidade e custo

Comparar uma execução do fluxo atual com uma execução do proposto, usando o mesmo briefing, conteúdo, framework, componentes disponíveis e, quando possível, modelo e configuração. Registrar diferenças inevitáveis. O piloto fornece evidência inicial, sem pretensão de significância estatística.

| Indicador | Como medir |
|---|---|
| Qualidade percebida | Avaliação do usuário de 1 a 5 para hierarquia, identidade, legibilidade, adequação ao objetivo e consistência |
| Usabilidade | Conclusão da tarefa principal, bloqueios e dúvidas observadas |
| Retrabalho | Quantidade de intervenções e tempo de ajuste manual |
| Custo | Tokens reportados, chamadas e custo efetivo quando disponível; estimativas identificadas com sua fonte |
| Tempo | Duração total, incluindo escolha de direção e revisão |
| Regressões | Quantidade e gravidade de problemas introduzidos nas correções |

**Regra de adoção proposta:** qualidade média superior à referência inicial, nenhum bloqueio crítico, esforço manual igual ou menor e consumo dentro do teto aprovado na etapa 0. Se houver ganho visual com maior custo ou esforço, apresentar o tradeoff e decidir explicitamente; não declarar sucesso automático.

Não há orçamento nem prazo fechado nesta proposta. Fixá-los sem auditoria do código e uma medição inicial produziria falsa precisão.

## 8. Controle de escopo, riscos e reversão

| Risco | Controle |
|---|---|
| Aumento de consumo | Duas alternativas apenas da primeira dobra; duas rodadas de correção; contexto limitado aos componentes e decisões relevantes |
| Revisões desfazerem partes aprovadas | Registrar decisões e aplicar alterações localizadas; conservar versões anteriores |
| Resultado visual homogêneo | Separar regras do Design System de escolhas permitidas de tema e composição |
| Avaliação subjetiva | Usar critérios fixos e avaliação humana sobre o mesmo conteúdo |
| Aprovar screenshots sem testar comportamento | Validar também tarefa principal, teclado e estados |
| Quebrar preview ou inspetor | Confirmar contratos existentes e incluir teste de regressão no piloto |

A forma de ativação deve ser definida após a auditoria, preferencialmente por configuração opcional. Preservar o fluxo anterior, contratos versionados e protótipos originais. Em caso de regressão ou consumo excessivo, desativar o fluxo experimental e restaurar a última versão estável, mantendo as evidências coletadas.

## 9. Registro de aprovação

| Decisão | Proposta | Status |
|---|---|---|
| Direção da iniciativa | Melhorar briefing, exploração visual, implementação e revisão renderizada | Pendente |
| Primeiro passo | Auditoria técnica e baseline do fluxo atual | Pendente |
| Escopo do piloto | Uma página ou fluxo curto, duas direções iniciais e duas rodadas de revisão | Pendente |
| Execução do piloto | Condicionada à estimativa e ao teto de consumo da etapa 0 | Pendente |
| Expansão | Avaliada após o relatório comparativo | Não autorizada nesta proposta |

**Aprovador:** ____________________  
**Data:** ____________________  
**Decisão:** aprovado / aprovado com ajustes / revisar  
**Condições e ajustes:** ____________________

## Referências

- `AGENT.md` e `manifest.yaml` do UX/UI Designer, consultados nesta conversa: base para o diagnóstico dos contratos, não comprovação da implementação atual.
- [Playwright — Visual comparisons](https://playwright.dev/docs/test-snapshots): comparação de screenshots para detectar regressões em relação a uma referência aprovada.
- [W3C WAI — Page Structure Tutorial](https://www.w3.org/WAI/tutorials/page-structure/): estrutura semântica, regiões e hierarquia de títulos.
