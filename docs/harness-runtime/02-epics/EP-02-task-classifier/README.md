# Épico 02 — Task Classifier

## Visão Geral
Serviço de classificação de tarefas e intenções do usuário utilizando o motor local Ollama, validando estritamente o contrato de saída:
- `tipo`: bug, feature, refactor, docs, test.
- `complexidade`: baixa, media, alta.
- `modulo`: string normalizada.
- `executorSugerido`: local_llm, cloud_llm, script, human.
- `justificativa`: explicação sucinta.

## Histórias de Usuário
- [02.01](02.01-contract-schema.md): Schema e validador estrito do contrato de classificação de tarefas.
- [02.02](02.02-classifier-service.md): Serviço de classificação com engenharia de prompt especializada e fallback local controlado.
