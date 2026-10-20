# 05 - Formato da resposta (F0 e F1)

Produzir, nesta ordem:

1. Resumo executivo.
2. Diagnostico do repositorio com evidencias.
3. Arquitetura atual e arquitetura proposta.
4. Matriz de funcionalidades existentes, reutilizaveis e novas.
5. Decisoes arquiteturais e tradeoffs.
6. Backlog priorizado com dependencias.
7. Plano de implementacao por etapas.
8. Estrategia de testes e benchmarks.
9. Metricas de sucesso.
10. Riscos, rollback e perguntas pendentes.

## Entregaveis da F0

Inventario tecnico do estado atual; fluxograma da arquitetura existente; matriz de reutilizacao versus novos componentes; gargalos com evidencias; riscos e oportunidades ordenados por impacto.

## Investigar na F0

Arquitetura dos motores e adaptadores; fluxo de uma solicitacao da interface a execucao; hooks e instrucoes injetadas por mensagem; duplicacao entre instrucoes globais, projeto, memoria e historico; scripts, MCPs e automacoes; cache, sincronizacao e persistencia; metricas de uso por motor; concorrencia, retries, loops e perda de contexto; Windows, WSL2, Docker e disponibilidade do Ollama.

## Encerramento

Entregar o plano completo para revisao. Nao iniciar alteracoes de producao. Apos aprovacao, comecar pelo menor incremento funcional, mantendo a aplicacao operacional e rodando testes a cada etapa.
