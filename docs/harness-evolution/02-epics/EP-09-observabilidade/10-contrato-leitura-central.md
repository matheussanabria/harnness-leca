# Contrato de leitura da Central (EP-09.02 ↔ EP-09.03)

> Contrato **congelado** entre as histórias 09.02 (event log, projeções e recuperação SSE) e 09.03 (Central pesquisável). A 09.02 implementa; a 09.03 consome. Mudar este contrato exige aviso no inbox da coordenação e atualização nos dois lados.

## 1. Por que existe

A Central não pode manter cópia própria das sessões (princípio de produto da Central) nem chamar APIs específicas de motor. Ela lê um **read model** projetado a partir do event log, exposto por um contrato único. Sem contrato congelado, as duas histórias duplicam estado — o que o ADR-005 (log persistente local) e o aceite do épico proíbem.

## 2. Entidade canônica

`CanonicalSession` (modelo em [03-modelo-canonico-sessao.md](03-modelo-canonico-sessao.md)):

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string (UUID) | gerado pelo Harness, estável |
| `schemaVersion` | inteiro | obrigatório; migração aditiva |
| `projectId` | string ou null | projeto quando houver evidência |
| `projectConfidence` | enum | `explicit`, `observed`, `inferred`, `unknown` |
| `title` | string | melhor título disponível |
| `titleSource` | string | origem do título (`declared`, `derived`, `fallback`) |
| `primaryProvider` | string | motor principal; não impede múltiplos vínculos |
| `executionStatus` | enum | estado operacional do motor |
| `workflowStatus` | enum | estado de trabalho (independente do motor) |
| `attentionStatus` | enum | resumo derivado da caixa de atenção |
| `createdAt` | ISO | menor timestamp confirmado |
| `lastObservedAt` | ISO | última observação válida |
| `archivedAt` | ISO ou null | arquivamento lógico |

Os três estados são **ortogonais** (ADR-006): um motor pode estar `idle` com workflow `blocked` e atenção `open`.

## 3. Query API

### `GET /api/project/:slug/sessions`

Parâmetros: `provider`, `executionStatus`, `workflowStatus`, `attentionStatus`, `projectConfidence`, `q` (busca em título, ID, projeto e artefato), `since`, `until`, `limit` (padrão 50, máximo 200), `cursor`.

Resposta:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-21T00:00:00.000Z",
  "cursor": "opaque",
  "sessions": [ { "...": "CanonicalSession" } ],
  "attention": { "count": 0, "bySeverity": { "high": 0, "medium": 0, "low": 0 } }
}
```

Regras: o corpo **nunca** inclui o conteúdo das mensagens; `sourceLocator` sai ofuscado; ordenação estável por `lastObservedAt` decrescente e, em empate, por `id`.

### `GET /api/project/:slug/sessions/:id`

```json
{
  "session": { "...": "CanonicalSession" },
  "providerSessions": [ { "provider": "claude", "nativeSessionId": "...", "sourceKind": "cli", "resumeMode": "native", "capabilities": [] } ],
  "artifacts": [ { "path": "chats/2026-10-21-x.md", "hash": "...", "lastSyncedAt": "..." } ],
  "executions": [ { "id": "...", "provider": "claude", "status": "succeeded", "startedAt": "...", "endedAt": "..." } ],
  "events": [ { "id": "...", "type": "execution.succeeded", "at": "..." } ],
  "attention": [ { "id": "...", "severity": "medium", "state": "open" } ]
}
```

### `GET /api/project/:slug/sessions/stream?cursor=<cursor>`

Server-Sent Events. Cada mensagem:

```
id: <cursor opaco>
event: <tipo canônico>
data: <envelope em JSON>
```

Tipos mínimos: `session.discovered`, `session.updated`, `session.linked`, `session.archived`, `execution.started`, `execution.succeeded`, `execution.failed`, `workflow.transitioned`, `workflow.blocked`, `approval.requested`, `approval.resolved`, `attention.opened`, `attention.resolved`.

Sem `cursor`: o servidor entrega do início. Com `cursor`: retoma de onde parou (o cliente reconecta com o último `id` recebido). Reconexão é segura e idempotente.

## 4. Envelope de evento

```json
{
  "id": "uuid",
  "type": "execution.succeeded",
  "at": "2026-10-21T00:00:00.000Z",
  "source": { "provider": "claude", "kind": "motor" },
  "trust": "observed",
  "projectId": "saude-dispensacao",
  "sessionId": "uuid",
  "executionId": "uuid",
  "payload": {}
}
```

`trust` é obrigatório (`observed` ou `inferred`) e `source` nunca carrega caminho absoluto nem segredo.

## 5. Aliases durante a migração

O catálogo atual aceita aliases para não reescrever histórico: `execution.completed` → `execution.succeeded`, `workflow.transitioned` (canônico) e `task.*` (do event engine da 08.04) continuam aceitos na entrada. A Central mostra o nome canônico.

## 6. Split de arquivos (evita colisão entre as histórias)

| História | Arquivos |
|---|---|
| 09.01 | `ui/server/services/canonical-sessions/**`, `ui/server/routes/canonical-sessions.routes.js` |
| 09.02 | `ui/server/services/events/**` |
| 09.03 | `ui/public/js/modules/central-*.js`, `ui/public/css/design/23-central*.css` |

**Hubs com um dono só por rodada:** `ui/server/router.js`, `ui/public/css/index.css`, `ui/public/css/design.css`, `ui/public/js/window-manager/window-registry.js` e `ui/public/index.html`. O lado que não é dono não edita esses arquivos: entrega a integração em commit próprio, avisando no inbox.

## 7. Estratégia da 09.03 enquanto a 09.02 não fecha

A Central é construída **front-first**: nasce com um adaptador de leitura (mock determinístico, mesmo formato do contrato) e troca para o cliente real quando a 09.02 for aceita. O mock nunca é ativado por padrão em produção — a troca é um ponto único de injeção, e o aceite da 09.03 exige o cliente real ligado.
