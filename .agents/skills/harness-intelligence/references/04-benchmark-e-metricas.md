# 04 - Benchmark e metricas

## Datasets representativos do Harness

Classificacao de tarefas, extracao de JSON, recuperacao de arquivos relevantes, resumo de sessoes, documentacao, geracao de testes, correcao de bugs simples e revisao de codigo. Datasets versionados.

Comparar script puro, LLM local e nuvem (quando autorizada). Registrar qualidade, tempo total, latencia, tokens/s, memoria, falhas e tentativas.

## Indicadores de sucesso

| Indicador | Demonstra |
|---|---|
| Tarefas concluidas corretamente | Efetividade geral |
| Chamadas de nuvem evitadas | Economia de cotas |
| Tokens de entrada e saida | Consumo por execucao, quando disponivel |
| Tempo por tarefa concluida | Eficiencia operacional |
| Tentativas e loops | Retrabalho |
| Cache hit rate | Reutilizacao de resultados |
| Acuracia do roteador | Qualidade da escolha do executor |
| Pico de RAM e CPU | Viabilidade dos modelos locais |
| Falhas e regressoes | Seguranca das mudancas |

## Regras de medicao

- Distinguir dados reportados, estimados e indisponiveis.
- Separar tokens de API das cotas de assinatura dos motores CLI.
- Nunca inventar metrica que o provedor nao disponibiliza.
- Construir a linha de base antes de declarar economia.
- Escolher modelos por benchmark real, nao por tamanho ou popularidade.
