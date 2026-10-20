---
id: ADR-006
titulo: Separar execução, workflow e atenção
status: proposta
data: 2026-10-19
historias: [09.02, 09.03, 09.05]
tags: [harness-evolution, adr, workflow]
---

# ADR-006: Separar execução, workflow e atenção

## Contexto

Uma execução técnica pode terminar com sucesso e ainda aguardar aprovação, testes ou aceite. Da mesma forma, uma sessão observada sem atividade não está necessariamente concluída. Um único campo de status produziria transições falsas e um Kanban inconsistente.

## Decisão proposta

Modelar três eixos:

- `executionStatus`: condição técnica da execução;
- `workflowStatus`: etapa controlada do trabalho;
- `attentionStatus`: necessidade atual de intervenção.

Projeções podem sugerir mudanças entre eixos, mas somente regras explícitas ou decisão do usuário aplicam transições de workflow.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Um status universal | UI simples | Mistura conceitos e perde combinações válidas |
| Status por provedor | Fidelidade à fonte | Impossibilita visão transversal e Kanban comum |
| Três eixos normalizados | Semântica clara e extensível | Mais campos e regras de projeção |

## Justificativa

A separação impede que `execution.completed` seja exibido como trabalho concluído e permite sinalizar aprovação ou bloqueio sem falsificar a telemetria do motor.

## Consequências

Positivas:

- indicadores confiáveis;
- Kanban independente da execução;
- notificações derivadas de atenção;
- compatibilidade com motores que oferecem pouca telemetria.

Trade-offs:

- cartões precisam mostrar mais de um indicador;
- migração não pode mapear estados legados automaticamente sem confiança;
- regras de transição exigem auditoria.

## Revisão

Revisar se surgir um padrão de workflow único que represente comprovadamente todas as fontes e necessidades de intervenção.
