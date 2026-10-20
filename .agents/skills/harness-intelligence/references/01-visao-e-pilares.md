# 01 - Visao e pilares

## Conceito

Iniciativa Harness Intelligence & Automation. Estrategia: Script-First, Local-First, Cloud-on-Demand. Objetivo: maximizar a produtividade dos agentes CLI, reduzir o consumo das cotas semanais (Claude, Codex, Gemini, OpenCode) e preservar a qualidade.

A solucao nao e trocar os motores por modelos locais. E uma camada que decide qual recurso executa cada tarefa.

## Cinco pilares

1. Automacao deterministica: scripts para o que nao exige raciocinio generativo.
2. IA local: modelos pequenos para classificacao, extracao, sintese e operacoes simples.
3. Contexto inteligente: so os arquivos, instrucoes e informacoes necessarios.
4. Roteamento hibrido: script, modelo local ou nuvem conforme complexidade, capacidade e orcamento.
5. Observabilidade: consumo, qualidade, tempo, tentativas, cache e resultados.

Nao definir porcentagem de economia antes de medir a linha de base.

## Infraestrutura de referencia (hipoteses a validar por benchmark)

| Recurso | Configuracao |
|---|---|
| CPU | AMD Ryzen 5 7430U, 6 nucleos e 12 threads |
| RAM | 16 GB |
| GPU dedicada | Nao |
| Ambiente | Windows, WSL2 e Docker |
| Runtime local | Ollama |
| Modelos candidatos | Qwen3 0.6B, Qwen2.5-Coder 3B, Qwen3 4B |

Inicio proposto: uma inferencia simultanea, um modelo carregado, contexto de 2K a 4K tokens, testes com 4 e 6 threads. Considerar tambem IDE, navegador, containers e servicos do Harness.

## Arquitetura conceitual

Interfaces (Chat, DAI, Studio, Scrum, Escritorio 3D) chamam o Task Orchestrator (classificacao, politicas, orcamento, permissoes), que escolhe entre Script Engine (Git, AST, MCP, testes, indices), Local Engine (Ollama, Qwen, CPU) e Cloud Engine (Claude, Codex, Gemini, OpenCode). Transversais: Quality Gate, Context Engine e Resource Governor (validacao, memoria, metricas, limites, checkpoints).

Estrutura conceitual: os nomes e a localizacao reais seguem o repositorio. Examinar o codigo antes de propor arquivos, servicos ou abstracoes.

## Anti-padrao

Assumir que a duplicacao documental e desperdicio efetivo de tokens sem verificar os payloads e os caches dos provedores.
