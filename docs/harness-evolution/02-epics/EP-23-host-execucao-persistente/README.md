---
id: EP-23
titulo: Host de execução persistente
prioridade: P0
status: planejado
depende: [EP-09, EP-17.01]
tags: [harness-evolution, epico, chat, motores, resiliencia, sqlite, vps]
---

# EP-23: Host de execução persistente

[Voltar ao índice](../../00-index.md)

## Objetivo

Uma resposta do chat nunca se perde porque o servidor web reiniciou. Os motores (claude, codex, opencode, gemini) rodam num processo de vida longa, os eventos de cada execução ficam gravados em SQLite antes de chegar na tela, e a interface só exibe e religa.

## Problema em uma frase

O servidor roda com `npm run ui:dev` (`node --watch-path=ui/server --watch-path=tools/lib ...`), qualquer arquivo salvo nessas pastas reinicia o processo, e como as execuções vivem num `Map` em memória ([chat-run-registry.service.js](../../../../ui/server/services/chat-run-registry.service.js)) e as CLIs são filhas desse processo, o reattach por `seq` recebe 404 e a tela mostra "A execução expirou no servidor".

## Evidências (2026-11-19)

- Processo filho do watcher iniciado às 09:20, 23 minutos depois do watcher (08:57): houve ao menos um reinício no uso normal.
- Erro vem de [chat-stream-resume.js:107](../../../../ui/public/js/modules/chat-stream-resume.js) quando `GET /api/chat/attach` responde 404.
- A reconexão já funciona para queda de rede e tela bloqueada, porque nesses casos o processo continua vivo.
- O registro guarda execuções terminadas por só 2 minutos (`KEEP_AFTER_END_MS`) e aborta execuções sem ninguém assistindo após 10 minutos (`RUN_GRACE_MS`).

## Referência: OpenBot (nightly-labs/openbot)

Desenho que inspira o épico, lido na documentação pública do projeto em 2026-11-19:
- O host que roda os agentes quase nunca reinicia (app empacotado ou serviço systemd); os agentes editam workspaces próprios, nunca o código do host.
- `openbot.db` (SQLite) é a fonte da verdade: o código do provedor envia eventos ao `AgentService`, que grava as projeções antes de avisar a interface.
- Reinício espera agentes ociosos (mensagens novas ficam na fila com motivo `agent-restarting`); execução cortada fica "interrompida" com o histórico salvo; tarefas pendentes são reenviadas (`resumePendingRuns`).
- Cada host (local, VPS) tem seu próprio banco; o cliente lista os hosts da conta e consulta cada um, sem sincronizar bancos.

## Decisões deste épico

1. **Node continua.** O host é um processo Node separado, sem framework novo. Troca de framework HTTP fica fora deste épico.
2. **Um banco por host, o do ADR-012.** O diário de execuções vai para `data/harness.sqlite`, aberto só pelo módulo `ui/server/db/` (EP-17.01), com a migração `011` reservada no [EP-17](../EP-17-sqlite-persistencia/README.md). Nada de arquivo novo (`runs.sqlite`) nem de banco por projeto. Por isso a 23.02 depende da 17.01.
3. **Um processo dono por tabela.** Com o host de motores (23.03), dois processos abrem o mesmo arquivo, cada um pela própria conexão do `ui/server/db/` (WAL e `busy_timeout`). Cada tabela tem um único processo que escreve nela; o outro pede pela API do dono. Regra registrada na 17.01, seção 5 (emenda de 2026-11-19), e no ADR-012, item 2.
4. **Gravar antes de publicar.** Todo evento de execução é gravado e só depois enviado à tela, com idempotência por `run_id + seq`.
5. **Contrato HTTP do chat inalterado** para o navegador: `POST /api/chat`, `GET /api/chat/attach?runId=&from=` e a parada continuam iguais; muda só quem atende por trás.
6. **Vários hosts não reabrem o Postgres.** O ADR-012 pede revisão "se o Harness virar multi-host"; aqui cada host tem o seu banco e ninguém escreve no banco de outro host (modelo do OpenBot), então o SQLite continua valendo.
7. **Desktop fica para depois.** Nada aqui depende de Electron ou Tauri; o seletor de host (23.06) é o que um futuro app desktop reaproveitaria.

## Quem guarda o quê

| Classe de dado | Fonte da verdade | Regra |
|---|---|---|
| Estado da aplicação (execuções, conversas, telas, scrum) | `data/harness.sqlite` do host | Só pelo módulo `ui/server/db/`; separado por `project_id` |
| Event log do EP-09 | Hoje `projects/<slug>/coordination/events.sqlite` | Divergência conhecida do ADR-012; consolida no banco do host na 17.10 |
| Memória, instruções, `context/`, docs, fontes do Ateliê | Arquivos no git | Ficam em disco: precisam de diff e são editados pelas CLIs (ADR-012, item 4) |
| Estado das ferramentas (`opencode.db`, `9router/data.sqlite`, `~/.codex`, `~/.claude`) | A própria ferramenta | Só leitura (`readOnly: true`); nunca escrever |
| Preferências do aparelho | `localStorage` | Só cache e preferência; nunca o único lugar de algo que o servidor precisa |

## Dono de cada tabela

| Tabela | Processo dono (escreve) | Quem lê |
|---|---|---|
| `chat_runs`, `chat_run_events` | Host de motores (desde a 23.03; no modo antigo `HARNESS_ENGINE_HOST=0`, o servidor web) | Servidor web, só pela API do host |
| `chat_conversations`, `chat_engine_sessions`, `chat_messages` (17.02) | Servidor web | Host, pela leitura do repositório |
| Demais tabelas do EP-17 | Servidor web | Host não acessa |

## Aceite do épico

- Salvar um arquivo em `ui/server` com uma resposta em andamento não interrompe a resposta: ela termina e aparece completa na tela.
- Reiniciar o servidor web com o host de motores parado mostra a resposta parcial como "interrompida", com botão de retomar, e nunca o erro "expirou no servidor".
- Voltar a uma conversa 1 hora depois de a resposta terminar mostra a resposta completa (sem 404).
- A mesma interface abre o host local e o host da VPS, um de cada vez, pelo seletor.

## Regras que valem para todas as histórias

- Código em worktree próprio, testado e revisado antes de chegar na `main`.
- Arquivos abaixo de 300 linhas, ícones FontAwesome, zero emojis, linha no mapa (`docs/mapa/`) no mesmo commit.
- Nada de segredo em evento gravado: o diário guarda texto da resposta e metadados, nunca token ou variável de ambiente.

## Ordem e paralelismo

```
23.01 main sem auto restart (paliativo imediato)
17.01 fundação do banco ──► 23.02 diário de execuções ──► 23.03 host de motores separado ──► 23.05 reinício seguro
                                                    └──► 23.04 interrompida e retomar
23.03 ──► 23.06 seletor de host (local e VPS)
23.03 + 23.05 ──► 23.07 host por checkout (porta própria, identidade, parada que diz a verdade)
```

23.01 é independente e entra primeiro. A 17.01 (EP-17) vem antes da 23.02 e pode andar em paralelo com a 23.01. 23.02 já acaba com o 404 de execução terminada; 23.03 acaba com a queda no meio da resposta.

## Pré-requisito de decisão

O ADR-012 foi aceito em 2026-11-19, com a emenda da disciplina de escrita.

## Frente e coordenação

Sem owner definido em `EPIC_OWNERS` (`tools/lib/coordination/config.js`): definir a frente antes de abrir a primeira história e rodar `node tools/coordination.js sync`.

## Histórias

| ID | Título | Status |
|---|---|---|
| [23.01](23.01-main-sem-auto-restart.md) | Main sem auto restart | Planejada |
| [23.02](23.02-diario-execucoes-sqlite.md) | Diário de execuções do chat em SQLite | Concluída (merge 4bfa4fd) |
| [23.03](23.03-host-motores-separado.md) | Host de motores em processo separado | Implementada (branch `feat/ep-23.03-engine-host`) |
| [23.04](23.04-interrompida-retomar.md) | Execução interrompida visível e retomável | Implementada (branch `feat/ep-23.04-interrupted`) |
| [23.05](23.05-reinicio-seguro.md) | Reinício seguro e aviso de reconexão | Implementada (branch `feat/ep-23.05-safe-restart`) |
| [23.06](23.06-seletor-host.md) | Seletor de host: local e VPS | Planejada |
| [23.07](23.07-host-por-checkout.md) | Host de motores por checkout: porta própria, identidade e parada que diz a verdade | Planejada |
