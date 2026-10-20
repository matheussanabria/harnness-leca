# Matriz de capacidades por motor

## Legenda

- **verificada**: há implementação correspondente no código atual;
- **condicional**: existe somente em um modo ou para execução iniciada pelo Harness;
- **observacional**: a fonte pode ser lida, mas não controlada;
- **indisponível**: não há mecanismo comprovado;
- **planejada**: depende de implementação do EP-09.

## Matriz

| Capacidade | Claude Code | Gemini API | Gemini Antigravity/Bridge | OpenCode | Codex |
|---|---|---|---|---|---|
| Descobrir sessões | Verificada, JSONL | Indisponível remotamente | Verificada, transcript local | Verificada, SQLite | Verificada, JSONL local |
| Importar histórico | Verificada, identidade composta | Via conversa salva | Verificada, identidade composta | Verificada | Verificada |
| Enviar mensagem | Verificada, CLI | Verificada, API | Condicional: Bridge apenas enfileira | Verificada, REST local | Verificada, CLI |
| Retomar sessão nativa | Verificada por UUID | Indisponível | Indisponível | Verificada por `ses_*`, melhor esforço | Verificada por UUID |
| Continuidade por replay | Não necessária quando resume | Verificada pelo histórico enviado | Não comprovada | Não necessária quando resume | Não necessária quando resume |
| Cancelar execução do Harness | Condicional, árvore do processo | Condicional, `AbortSignal` | Indisponível | Condicional, `/abort` | Condicional, subprocesso atual |
| Cancelar execução externa | Indisponível | Indisponível | Indisponível | Não presumida | Indisponível |
| Aprovação interativa | Verificada via MCP | Indisponível | Indisponível | Indisponível | Indisponível no Harness |
| Detectar subagente | Verificada por `isSidechain` | Indisponível | Observacional por tool call | Verificada por `parent_id` | Ainda não adaptada |
| Detectar conclusão | Parcial/observacional | Verificada no stream iniciado | Observacional pelo transcript | Parcial por mensagens/estado | Verificada no processo iniciado |
| Projeto nativo confiável | Caminho/cwd com reconciliação | Projeto do pedido | Inferido de conteúdo/caminho | Diretório da sessão | `cwd` da sessão |
| Adaptador no Event Engine | Verificado | Compartilha identidade Gemini | Verificado | Verificado | Planejado |

## Resolução de capacidades

A Central não deve usar booleanos globais como `cancelSupported`. A decisão depende da sessão e da execução:

```text
capability = provider support
           + source mode
           + ownership of execution
           + current availability
           + valid native session identifier
```

Exemplo: Claude suporta cancelamento somente quando o Harness conserva o handle do subprocesso. Uma sessão Claude detectada em terminal externo é navegável e potencialmente retomável, mas não cancelável.

## Contrato planejado

Cada sessão terá um snapshot de capacidades com:

| Campo | Valores esperados |
|---|---|
| `discover` | `available`, `unavailable` |
| `send` | `available`, `degraded`, `unavailable` |
| `resume` | `native`, `context_replay`, `unsupported`, `unknown` |
| `cancel` | `owned_execution_only`, `unsupported`, `unknown` |
| `approval` | `native_queue`, `unsupported`, `unknown` |
| `reason` | justificativa curta e verificável |
| `checkedAt` | instante da avaliação |

## Regras de apresentação

1. Botões de ação só ficam habilitados quando a capacidade da sessão permitir.
2. Capacidade `unknown` nunca é convertida em “disponível”.
3. “Retomar” significa retomar a sessão nativa; “Continuar com contexto” é uma ação distinta.
4. Bridge Gemini deve aparecer como envio assíncrono, não como resposta interativa.
5. Cancelamento nunca será oferecido para execução externa observada.
6. A matriz exibida deve vir do mesmo resolvedor usado para autorizar a operação no backend.
7. IDs nativos iguais em motores diferentes não provam identidade única e nunca podem causar sobrescrita; a chave mínima de origem é `(provider, nativeSessionId)`.
