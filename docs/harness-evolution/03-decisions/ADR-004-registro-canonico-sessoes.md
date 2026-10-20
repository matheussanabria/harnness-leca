---
id: ADR-004
titulo: Registro canônico de sessões independente dos motores
status: proposta
data: 2026-10-19
historias: [09.01, 09.03, 09.04]
tags: [harness-evolution, adr, sessoes]
---

# ADR-004: Registro canônico de sessões independente dos motores

## Contexto

Claude, Gemini, OpenCode e Codex possuem IDs, fontes, retomada e telemetria diferentes. O Harness também mantém artefatos Markdown, sessões no navegador e execuções do Event Engine. Usar qualquer uma dessas formas como modelo universal perde informação e induz capacidades falsas.

## Decisão proposta

Introduzir `CanonicalSession` como identidade estável do Harness. Ela referencia uma ou mais sessões nativas, artefatos de conversa, execuções e transições de workflow. Adaptadores traduzem as fontes para o modelo sem apagar o identificador original.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Usar Markdown como sessão | Compatível e legível | Um único `agente/sessao`; não representa execução ou fonte não importada |
| Usar o ID nativo do motor | Simples por provedor | Colisão semântica, múltiplos motores e migração difícil |
| Consultar cada motor diretamente na UI | Evita registro intermediário | Acopla UI, duplica regras e impede visão confiável offline |
| Registro canônico com vínculos | Preserva fontes, suporta projeções e extensão | Exige reconciliação e migração aditiva |

## Justificativa

O registro canônico é a única alternativa que permite pesquisa transversal e compatibilidade sem fingir paridade entre motores. O custo adicional fica concentrado em adaptadores testáveis.

## Consequências

Positivas:

- interfaces independentes do provedor;
- múltiplas sessões por conversa comparativa;
- histórico e capacidades preservados por fonte;
- navegação estável entre Central, Chat e Escritório.

Trade-offs:

- correspondências inferidas precisam de revisão;
- modelos atuais terão período de convivência;
- será necessário versionar schema e migrações.

## Revisão

Revisar se os motores passarem a expor um protocolo comum, persistente e comprovadamente compatível com o histórico local do Harness.
