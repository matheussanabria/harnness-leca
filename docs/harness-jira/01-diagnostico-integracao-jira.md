# Diagnóstico: integração Harness × Jira (escritório 3D e além)

**Rodada:** diagnóstico (sem implementação)
**Base analisada:** documento executivo "Integração do Harness com o Jira" (21/10/2026) × repositório `harness-leca`
**Data da análise:** 21/10/2026

Legenda de evidência usada no texto:
**[Fato]** observado diretamente no código ou nos artefatos indicados.
**[Inferência]** conclusão razoável a partir de fatos, não verificada diretamente.
**[Proposta]** recomendação de desenho, ainda não existente no código.

---

## 0. Retificação (21/10/2026, 17:40) — o que mudou na árvore de trabalho durante esta análise

**O diagnóstico abaixo foi escrito contra o commit `2564220` (HEAD no início da sessão). Durante a análise, outra frente de trabalho entrou na árvore de trabalho, sem commit, entre 17:05 e 17:24, e criou a integração viva com o Jira que este relatório julgava ausente.** As afirmações marcadas como **[REVER]** são corrigidas aqui; o resto do relatório vale como diagnóstico do commit `2564220`.

**O que passou a existir (todos sem commit, `git status` mostra `??`):**

| Arquivo | O que faz |
|---|---|
| `tools/lib/jira-export.js` (64 linhas) | Cliente REST v2: `createClient` com `Authorization: Bearer`, `exportJiraSnapshot` pagina o `search` por JQL, **descobre o campo Sprint pelo nome** (`findSprintFields`), completa comentários truncados (`completeComments`) e grava o snapshot por arquivo temporário + `rename` (escrita atômica). Credenciais só de `JIRA_BASE_URL`/`JIRA_PAT`. |
| `tools/export-jira-snapshot.js` (23 linhas) | CLI que chama o núcleo acima. |
| `ui/server/controllers/scrum-jira-sync.controller.js` (37 linhas) | `POST /api/project/:slug/scrum/jira-sync` (rota em `ui/server/router.js:103`): credenciais **só do ambiente do servidor**, `409` se já há sincronização, grava `_jira-dis.json` no repositório do projeto e devolve o quadro recarregado. |
| `ui/public/js/modules/design-scrum-jira-sync.js` (35 linhas) | Botão **“Sincronizar Jira”** na aba Scrum (`design-scrum-view.js:21`), com estado de carregamento e aviso de erro. |
| `ui/server/services/project-scrum-jira-sprints.js` (62 linhas) | Extrai sprints do payload sem depender do id do campo: formato legado do Server (texto `Sprint@...[id=..,name=..]`) e objeto do Cloud. `currentSprint` escolhe a ativa mais recente. |
| `tests/jira-export.test.js` | Testes do export (inclusive o erro de credencial ausente). |

**Consequências sobre as conclusões do relatório:**

| Afirmação original | Situação | Correção |
|---|---|---|
| §2.4 “Não existe cliente HTTP de Jira, base URL, token, tabela de transições, leitura de `/transitions`, nenhum `POST`/`PUT` para o Jira” | **[REVER] Parcialmente falsa** | **Existe** cliente HTTP de **leitura** (export + sync). **Continua não existindo**: escrita no Jira (`POST`/`PUT`/transição), leitura de `/issue/{key}/transitions`, tabela de transições, idempotência, auditoria de escrita. |
| §2.4 “O Harness não tem integração com o Jira — tem um snapshot de leitura” | **[REVER] Enfraquecida** | O Harness tem **frescura** de leitura (o botão regenera o snapshot a pedido, com o PAT no servidor). Continua sem **escrita**. |
| §3 linha 2 “Consulta ao vivo: **ausente**” | **[REVER] → existente (leitura)** | O botão Sincronizar Jira consulta o Jira ao vivo e reescreve o snapshot. |
| §3 linha 8 “Sprint de destino = ausente (`sprintId: null`)" | **[REVER] → existente (leitura)** | O snapshot passa a trazer o campo Sprint (`customfield_10100`) e `project-scrum-jira-sprints.js` o interpreta. 421 das 473 issues têm sprint. |
| §2.6 “Variante é inferência (Server/DC)” | **[REVER] → confirmada** | O payload do sprint é o **texto legado do Server** (`com.atlassian.greenhopper.service.sprint.Sprint@...[id=..,name=..]`) em `customfield_10100` — o Jira **Cloud** devolveria objeto. Instância = **Jira Server/Data Center**, REST v2. |
| §6 “Etapa 1 — Leitura viva” | **[REVER] → implementada (não commitada)** | O que era a Etapa 1 do plano já existe na árvore de trabalho. **A Etapa 2 (destino explícito + dry-run) e a Etapa 3 (escrita de uma transição) continuam válidas e são as próximas.** |
| §10.1 “Variante não verificada” | **Respondida** | Variante confirmada por evidência no payload. Permanece aberta a **lista de transições por issue** (não lida por ninguém até agora). |
| §2.6 contagem por status (9 status) | **Desatualizada** | O snapshot foi regerado às 17:20: **10 status**, `Concluído` 384, `A Fazer` 33, `SELECIONADO` 15, `Desenvolvimento` 13, `Cancelado` 11, `Em Impedimento` 8, `Em testes` 3, `TESTADO` 3, `Em Homologação` 2, `Em Revisão` 1. O número de status é **móvel**: qualquer tabela de mapeamento precisa de data de referência. |

**Detalhe que o relatório original não tinha e que muda o plano:** o Jira do projeto tem **71 sprints** (4 `active`: Sprint 38, 39, 40, 41; 1 `future`: Sprint 42), enquanto o quadro local do Harness tem **duas sprints próprias** (`Sprint 3` ativa, `Sprint 4` planejada) que **não têm relação de nome com as sprints do Jira** (`project-scrum-ops.js:100-107` aloca histórias em sprints locais). São **dois conceitos homônimos e distintos** — qualquer mapa "sprint de destino" precisa dizer de qual sprint se trata.

**O que continua exatamente como o diagnóstico disse:** a escrita no Jira não existe, o telão 3D é somente leitura, o MCP de Jira não existe, a transição do quadro não tem autor, e o mapeamento status→raia continua sendo de uma direção só. **A recomendação central do relatório (Etapa 2 e Etapa 3: destino explícito + uma escrita de transição, com reconciliação) não muda.**

**Achado adicional desta rodada — dados pessoais no snapshot (risco de LGPD, não só de token):** o snapshot **não contém só metadados**. Dos 473 issues, **199 têm comentários**, e esses comentários trazem **identificadores diretos de pacientes** — por exemplo, em `DIS-3`: *"Ver CPF 46957448053, Omeprazol entre 2 blísteres em 29/06"* e *"Ver CPF 01937386007, entrega feita hoje"*. Traz também nome, e-mail e telefone de servidores da Secretaria Municipal de Saúde. **[Fato]**

Consequência: qualquer fluxo que **leia comentários do Jira e os leve a um modelo externo** (o opencode gratuito do tipo `*-free`, ou um provedor de nuvem) **estará enviando dado pessoal de paciente a terceiro** — exatamente o que a política do projeto evita com o PAT (`projects/saude-dispensacao/instructions.md:16`) e o que o `AGENTS.md:11` manda tratar como dado sensível. A leitura via MCP ou a chamada direta à API do Jira pelo modelo têm esse risco embutido; um **script local que filtra antes de imprimir** não.

Por isso a implementação desta rodada (`tools/jira-query.js`) **redige por padrão** CPF, CNS, e-mail, telefone e data de nascimento (`tools/lib/jira-redact.js`), e o panorama gerado em `context/jira-resumo.md` **não leva comentários**. A opção `--raw` existe para uso estritamente local e deve continuar fora de qualquer prompt de modelo. **[Proposta]** Recomendo registrar isso como memória do projeto e como pergunta ao PM (§10), porque é uma decisão de política de dados, não de implementação.

---

## 1. Resumo executivo

**Viabilidade: a consulta é viável e de baixo custo; a escrita direta a partir do telão 3D, como enunciada no documento executivo, não é viável no desenho atual e não deve ser a primeira entrega.**

Três achados sustentam isso:

1. **O Harness não tem integração com o Jira — tem um *snapshot* de leitura.** Não existe cliente HTTP, credencial, URL de Jira nem escrita no repositório. A única leitura é o artefato local `doc/scrum/_jira-dis.json`, aberto e normalizado por `ui/server/services/project-scrum-jira-source.js:105-122` (o próprio arquivo declara, linha 104: *"Le o artefato local; nunca acessa rede nem credenciais"*). **[Fato]**

2. **O quadro do Harness tem 12 raias; o Jira do projeto tem 9 status, e o mapeamento existente é de uma direção só (status → raia).** Não existe o mapeamento inverso (raia → status/transição do Jira) em nenhum lugar do código. Consequência direta: *arrastar um card para a coluna "Pronto para deploy" não tem, hoje, nenhuma transição de Jira correspondente e inequívoca*. **[Fato]**

3. **O telão 3D não aceita arraste.** A projeção do Kanban na Sala de Guerra é renderização em canvas 2D, sem picking, sem drag e sem escrita — a história EP-05.06 a define como *"projeção somente leitura"* e exige explicitamente que o escritório *"não grava nem altera o arquivo ao projetar"* (`docs/harness-evolution/02-epics/EP-05-scrum/05.06-projecao-kanban-telao.md:33`). O quadro com arraste real é o **painel tradicional** (`ui/public/js/modules/design-scrum-sprint.js:58`), e é ele que já implementa transição com concorrência otimista, histórico e conflict-409. **[Fato]**

**Recomendação:** evoluir a integração existente (não introduzir servidor MCP agora) criando uma **camada de operação compartilhada no backend** que já possua a regra de transição, com **um adaptador de Jira** traduzindo raia → transição de Jira por tabela **explícita e configurável** (nunca derivada do nome visível). O **painel tradicional** vira o primeiro cliente dessa camada; o escritório 3D entra depois, por paridade (EP-10.05, ainda pendente). A MCP entra só depois que a operação estiver estável e medida.

**Primeira entrega recomendada (ver seção 6):** *Consulta ao vivo ao Jira* (substituindo o snapshot manual) **+** tabela de mapeamento raia→status **+** modo *simulação* (dry-run) da transição, **sem nenhuma escrita no Jira**. A escrita entra na etapa seguinte, atrás de flag.

**Ressalva de escopo:** este diagnóstico não inspecionou a instalação do Jira (sem credenciais, sem rede autorizada) nem executou escrita. A variante do Jira é **inferida** (§2.6); a lista real de transições por issue **não foi verificada** e é pré-requisito de qualquer escrita.

---

## 2. Estado atual

### 2.1 Identificação do repositório

| Item | Valor |
|---|---|
| Repositório | `C:\Users\matheuss.rodrigues\git\harness-leca` |
| Branch | `main` |
| HEAD | `2564220` — `docs(harness): registra a 09.01 detalhada e o saneamento da suite` |
| Estado local | 20 arquivos modificados, **não commitados** (`MAPA.md`, `docs/harness-evolution/**`, `tests/studio-views.test.js`, `tools/lib/coordination/config.js`, `ui/public/css/**`, `ui/public/js/modules/**`, `ui/server/router.js`) |

**[Fato]** As alterações locais são anteriores a esta rodada e **não foram tocadas** por ela; nenhuma escrita foi feita no repositório.

### 2.2 O quadro e o telão: o que existe

**Painel tradicional (interativo, com arraste) — é onde a história hoje vive:**

| Peça | Caminho:linha | Papel |
|---|---|---|
| Colunas com drop de história | `ui/public/js/modules/design-scrum-sprint.js:58` | `ondragover="allowScrumStoryDrop"` / `ondrop="dropScrumStory"` por raia |
| Card arrastável | `ui/public/js/modules/design-scrum-story-card.js:20-21` | `draggable="true"`, `onclick`/`onkeydown` abrem detalhes |
| Drag &amp; drop e envio | `ui/public/js/modules/design-scrum-story-transition.js:62-89` | `startScrumStoryDrag`, `dropScrumStory`, `moveScrumStoryByStep` |
| Chamada de rede da transição | `ui/public/js/modules/design-scrum-story-transition.js:25-47` | `POST /api/project/:slug/scrum/story/transition`; 409 → recarrega e foca o card |
| Alternativa por teclado/sem arraste | `ui/public/js/modules/design-scrum-story-card.js:44-45` | botões de passo `◀ ▶` chamam `moveScrumStoryByStep` (idêntico ao drop) |
| Alvos de toque | `ui/public/css/design/12-scrum-story-transitions.css:13-14` | `@media (pointer: coarse)` → alvos de 44×44 px |

**Escritório 3D / telão (leitura):**

| Peça | Caminho:linha | Papel |
|---|---|---|
| Renderizador da projeção | `ui/public/js/office3d/war-screen/war-screen-scrum.js:93-136` | `ctx.fillRect`/`fillText` por raia e card; **sem evento de ponteiro** |
| Modelo puro da projeção | `ui/public/js/office/war-screen-projection-model.js` | seleciona sprint ativa, raias visíveis, métricas |
| Carga do Scrum no escritório | `ui/public/js/office-state.js:159-174` | `GET /api/project/:slug/scrum` em paralelo com projeto e diário |
| Atualização por evento | `ui/public/js/office3d/world-war-room.js:36,92` | `dai:scrumChanged` → `refreshScreen()` |
| Abas do telão | `ui/public/js/office3d/war-screen/war-screen-tabs.js`, `ui/public/js/office/war-screen-tabs-model.js` | `Orquestração` (padrão) e `Kanban Scrum`, por clique ou tecla `E` |
| Especificação | `docs/harness-evolution/02-epics/EP-05-scrum/05.06-projecao-kanban-telao.md:21,33` | define a projeção como **somente leitura** e proíbe gravar ao projetar |

**[Fato]** Não existe, no código do escritório 3D, qualquer handler de arraste, picking de card ou escrita de Scrum. A busca por `dragstart|dragover|draggable|drop` em `ui/public/js` retorna apenas o painel tradicional (`design-scrum-*`), o protótipo (`prototype-layer-drag.js`, `prototype-bridge-drag.js`) e o protótipo de layer tree — nenhum no `office3d/`.

**[Fato]** O escritório 3D **alcança** o quadro interativo: a estação *whiteboard* mapeia para o módulo `scrum` do Window Manager (`ui/public/js/window-manager/station-adapter.js:38`, registro em `ui/public/js/window-manager/window-registry.js:134-135`). Ou seja: hoje o caminho "3D → mover card" existe, mas por **abrir o painel tradicional**, não por arrastar no telão.

**[Fato]** A paridade entre painel tradicional e escritório está declarada **pendente**: `docs/harness-evolution/00-index.md:146` → `- [ ] 10.05 Paridade entre painel tradicional e escritório`.

### 2.3 Backend do Scrum: regras, concorrência, auditoria

| Peça | Caminho:linha | Papel |
|---|---|---|
| Catálogo de 12 raias | `ui/server/services/project-scrum-lanes.js:4-22` | `backlog, discovery, refinamento, pronto-para-dev, em-desenvolvimento, em-revisao, pronto-para-testes, em-testes, pronto-para-homologacao, em-homologacao, pronto-para-deploy, concluido` |
| Regras de transição | `ui/server/services/project-scrum-transitions.js:26-55` | só **raias adjacentes** na ordem canônica, ambas ativas; `Math.abs(...) !== 1` → recusa |
| Conflito (concorrência) | `ui/server/services/project-scrum-transitions.js:41-45` | `SCRUM_STORY_CONFLICT` quando a raia real difere da esperada; exposto como **409** em `ui/server/controllers/scrum-transition.controller.js:34-36` |
| Revisão de raias | `ui/server/services/project-scrum-ops.js:188-197` | `SCRUM_LANES_CONFLICT` por `lanesRevision` |
| Persistência | `ui/server/services/project-scrum-persist.js:13-37,76-100` | `projects/<slug>/scrum.json`, escrita atômica (`writeJsonAtomic`) |
| Histórico de transições | `ui/server/services/project-scrum-ops.js:93-96` + `project-scrum-transitions.js:57-69` | registro append-only com `fromLaneId`, `toLaneId`, `occurredAt`, `storySource` |
| Rotas | `ui/server/router.js:129-140` | `GET /scrum`, `POST /scrum/story/transition`, `/status`, `/assign-sprint`, `/impediment`, `/lanes`, `/lanes/order`, `/status-mapping`, … |

**[Fato]** O `transitionHistory` **não tem campo de autor**. `createTransitionRecord` grava `id, storyId, storyKey, fromLaneId, toLaneId, fromStatus, toStatus, occurredAt, storySource` (`project-scrum-transitions.js:57-69`). A auditoria existe, mas não registra *quem* moveu.

**[Fato]** `project-scrum-ops.js:2` declara o invariante: *"Mutacoes locais: o snapshot Jira e a documentacao permanecem somente-leitura."* O teste `tests/project-scrum-transitions.test.js:126-140` fixa esse comportamento ("historia Jira grava somente estado local e preserva snapshot").

### 2.4 A integração com o Jira

**O que existe (leitura por snapshot):**

| Peça | Caminho:linha | Papel |
|---|---|---|
| Leitor do snapshot | `ui/server/services/project-scrum-jira-source.js:105-122` | lê `doc/scrum/_jira-dis.json`, cache por `mtimeMs` (linhas 6, 109-111) |
| Normalização | `ui/server/services/project-scrum-jira-source.js:41-77` | `id`, `jiraId`, `key`, `title`, `issueType`, `sourceStatus`, `relationships`, `epicId`, `assignee`, `creator`, `comments`, `attachments`, `provenance` |
| Marcação de origem | `ui/server/services/project-scrum-jira-source.js:73` | `source: "jira-snapshot"` |
| Épico por campo customizado | `ui/server/services/project-scrum-jira-source.js:44` | `fields.customfield_10101` |
| **Sprint ausente** | `ui/server/services/project-scrum-jira-source.js:72` | `sprintId: null` — o snapshot **não traz** sprint |
| Composição das fontes | `ui/server/services/project-scrum-persist.js:64-74` | `snapshot` + `doc/scrum/<KEY>/user-story.md` + estado local → `resolveScrumData` |
| Resolver (reconciliação) | `ui/server/services/project-scrum-resolver.js:29-66` | `provenance` por campo: `jira-snapshot` / `local-override` / `documentation` / `unavailable` |

**O que não existe:** cliente HTTP de Jira **[REVER — ver §0: existe desde 17:05, ainda sem commit]**, base URL, token/PAT, tabela de transições, leitura de `/rest/api/2/issue/{key}/transitions`, qualquer `POST`/`PUT` para o Jira, e qualquer servidor MCP de Jira. **[Fato]**

Busca de cobertura (o que foi e o que não foi procurado): busca por `jira` em todo o repositório (39 ocorrências, todas em `ui/server/services/project-scrum-*`, `ui/public/js/modules/design-scrum-*`, `tests/project-scrum-*` e documentação/memória); busca por `atlassian|api\.jira|rest/api/2|rest/api/3|Authorization: Bearer|PAT` no código — **zero** ocorrências de cliente. As ocorrências de "PAT" e "API REST v2 do Jira interno" estão em memória de projeto (`.claude/context/saude-dispensacao.md:48`, `.gemini/context/saude-dispensacao.md:48`) e descrevem um **script PowerShell local fora do repositório**, não código do Harness. A ausência de um *snapshot writer* no repositório foi confirmada por busca por `_jira-dis|jira.*export|jira-story` — os únicos acertos são a leitura (`project-scrum-jira-source.js:106`) e fixtures de teste.

**[Inferência]** O Harness **foi deliberadamente desenhado** sem acesso de rede ao Jira: a separação "coleta por script local com PAT em variável de ambiente" ↔ "Harness lê o artefato" é explícita na memória de projeto e no doc de desenvolvimento (`docs/harness-evolution/02-epics/EP-05-scrum/05-dev-notas.md:13`: *"O Harness não lê token, não chama o Jira e não usa a skill de publicação para exportação"*). Isso é uma decisão de segurança, não um acidente — e muda o plano: **qualquer introdução de escrita é uma nova decisão de produto, não uma extensão natural.**

### 2.5 MCP no Harness

| Peça | Caminho:linha | Papel |
|---|---|---|
| Único MCP do Harness | `tools/permission-mcp.js:16-30` | servidor stdio JSON-RPC, **uma** ferramenta: `approve` (pedido de permissão do Claude Code) |
| Configuração por projeto | `tools/lib/project-mcp.js:36-69` | `projects/<slug>/mcp.json` → `repo`, `modo`, `servidores`, `mcpServers` |
| Servidores do repositório | `tools/lib/project-mcp.js:53-59` | valida `servidores` contra o `.mcp.json` do repo |
| Isolamento na execução | `tools/lib/engines/claude.js:113,121-132` | `--strict-mcp-config` + `--allowedTools` com `mcp__<nome>`; MCPs do usuário ficam de fora |
| MCP do projeto DIS | `.mcp.json` do repo `saude/dispensacao` | `dis-design-system` → design system; **nada de Jira** |
| `.mcp.json` do harness-leca | — | **não existe** (`Test-Path` = falso) |

**[Fato]** Não há servidor MCP de Jira, nem no Harness, nem no repositório do projeto ativo. O único MCP que o Harness *é* é o de permissões. O único MCP *declarado* no projeto ativo é o de design system —_tools de design, sem relação com issues.

**[Fato]** O MCP do Harness comunica por **stdio** (`tools/permission-mcp.js:6-8`, uma mensagem JSON-RPC por linha) e fala com a interface por HTTP (`HARNESS_PERM_URL`, linha 14). Não é um serviço consultável pela UI.

### 2.6 Variante e contratos do Jira

**[Fato]** Snapshot real do projeto ativo: `C:/Users/matheuss.rodrigues/git/saude/dispensacao/doc/scrum/_jira-dis.json` — 473 issues (370 Histórias, 73 Problemas, 6 Tarefas, 24 Épicos).

**[Fato]** Status presentes no snapshot (nome → categoria `statusCategory`):

| Status | Issues | Categoria |
|---|---|---|
| Concluído | 383 | `done` |
| A Fazer | 33 | `new` |
| SELECIONADO | 15 | `indeterminate` |
| Desenvolvimento | 14 | `indeterminate` |
| Cancelado | 11 | `done` |
| Em Impedimento | 8 | `indeterminate` |
| TESTADO | 4 | `indeterminate` |
| Em testes | 4 | `indeterminate` |
| Em Revisão | 1 | `indeterminate` |

**[Fato]** O mapeamento status→raia existente (`project-scrum-resolver.js:13-27`) colapsa por `statusCategory` quando não há mapeamento explícito: `done → todo/done`, `indeterminate → in_progress`, `new → todo` (`project-scrum-resolver.js:6-11`).

**[Inferência]** A instalação é um **Jira Server/Data Center (REST v2)**, não Jira Cloud: `customfield_10101` como referência de épico (`:44`) é idoma Server/DC; o workflow tem status customizados em português ("SELECIONADO", "Em Impedimento", "TESTADO") e tipos "História/Problema/Tarefa/Épico"; a memória de projeto registra "API REST v2 do Jira interno" com PAT. **Não verificado** — não há credencial nem acesso autorizado a esta instância nesta rodada, e o tipo real de transição continua desconhecido.

**[Inferência]** Onde o mapeamento é 1:1 no nome, ele é frágil: "Concluído" (383) e "Cancelado" (11) caem **ambos** em `done`, e a regra canônica de lanes (`project-scrum-transitions.js:18`) **inclui `concluido`** — um card cancelado é indistinguível de um card entregue no modelo atual. **[Fato]** é que o modelo não tem `cancelled`; **[Inferência]** é a consequência de produto.

### 2.7 Identidade e autorização

**[Fato]** O Harness é uma aplicação local de usuário único, protegida por PIN (`ui/server/config.js:137,219` — `sendPinLoginPage`; `ui/server/router.js:247`). Não há login, sessão, papel ou identidade por usuário no modelo de dados do Scrum.

**[Fato]** O modelo de transição não tem autor (§2.3). O modelo de issue (`project-scrum-jira-source.js:66-67`) carrega `assignee`/`creator` do Jira, mas isso é **dado do Jira**, não identidade de quem age no Harness.

**[Inferência]** Se a escrita passar a existir, o "autor efetivo no Jira" será o dono do PAT usado pelo Harness — não o operador da UI, salvo se o Harness passar a identificar o usuário. Esta é a pergunta mais sensível do documento e a resposta, hoje, é: **não há identidade de escrita, porque não há escrita**.

### 2.8 Associação issue ↔ execução

**[Fato]** Existe uma ação "Enviar ao chat" (`ui/public/js/modules/design-scrum-actions.js:116-125`): o texto da história é montado e **injetado na caixa de texto do chat**. Não há gravação de vínculo, nem `executionId`, nem referência persistida. Busca por `executionId|execution_id|chatId|linkedChat` em `ui/public/js` e `ui/server` retorna apenas o subsistema de chat e o de orquestração (`workflow-runner.service.js`, `chat-execution-store.js`), **sem nenhuma ponte com o Scrum**.

**[Inferência]** O caso "associar uma issue à execução" do documento executivo (linhas 14 e 44) é, hoje, uma **convenção de texto**, não um modelo de dados. Implementá-lo como dado é trabalho novo (idempotência, quem linkage, quando desvincular).

### 2.9 Limites de acesso e verificações executadas

**[Fato]** Não foi inspecionada a instalação do Jira (sem credencial, sem rede autorizada); não foi lido nenhum arquivo de credencial; nenhum segredo foi impresso. O PAT do Jira vive em variável de ambiente fora do repositório, por decisão registrada em `.claude/context/saude-dispensacao.md:20`.

Verificações locais **não destrutivas** executadas:

| Comando | Resultado |
|---|---|
| `node --test tests/project-scrum-transitions.test.js tests/project-scrum-sources.test.js tests/design-scrum-transitions.test.js tests/war-screen-projection.test.js` | **21/21 passam** |
| `npm test` (suíte integral) | **875 passam, 1 pulado, 0 falham** (~110 s) |

Limitação relevante: a suíte do escritório é majoritariamente E2E/visual (`docs/harness-evolution/01-architecture/current-state.md:43`); a validação do telão é manual, o que afeta o custo de qualquer entrega que mexa na projeção 3D.

---

## 3. Matriz: proposta × situação

Legenda de situação: **existente** · **parcial** · **ausente** · **não verificada** (não foi possível inspecionar).

| # | Proposta (documento executivo) | Situação | Evidência | Lacuna | Impacto |
|---|---|---|---|---|---|
| 1 | Consultar tarefas e abrir descrição, critérios e comentários | **parcial** | `project-scrum-jira-source.js:41-77` normaliza descrição, `acceptanceCriteria: []` (linha 62), `comments` (linha 68); `project-scrum-doc-source.js` lê `doc/scrum/<KEY>/user-story.md` | Critérios e cenários vêm do **documento local**, não do Jira (`:62-63`); snapshot é manual e desatualizado | Consulta existe, mas **não é ao vivo** |
| 2 | Consultar **ao vivo** (fonte atual) | **ausente** | `project-scrum-jira-source.js:104-122` (comentário "nunca acessa rede") | Sem cliente HTTP, sem credencial, sem URL, sem cache de rede | Pré-requisito de qualquer escrita; exige decisão de segurança |
| 3 | Associar issue a uma execução do Harness | **ausente** | `design-scrum-actions.js:116-125` (só injeta texto); sem `executionId` no modelo Scrum | Não há vínculo persistido, nem chave, nem política | Caso de uso 2 do doc não é suportado |
| 4 | Mover história **no telão 3D** | **ausente** | `war-screen-scrum.js:93-136` (só `ctx`); `05.06-...md:33` ("somente leitura"); sem handlers de arraste em `office3d/` | Não há arraste, nem picking, nem escrita no 3D | O caso de uso **central** do documento não existe no código |
| 5 | Mover história **no painel tradicional** | **existente** | `design-scrum-sprint.js:58`; `design-scrum-story-transition.js:25-89`; rota `router.js:132` | Regra local, **sem qualquer efeito no Jira** | É o fluxo a evoluir; já tem conflito 409 e histórico |
| 6 | Coluna de status = transição de workflow | **não verificada** | 12 raias locais (`lanes.js:4-22`) × 9 status do Jira (§2.6) | A lista real de transições por issue **não foi lida**; a variante é inferida | Bloqueia a escrita: sem transições, sem destino legítimo |
| 7 | Raia = alteração de responsável | **não verificada** | 12 raias são **etapas de workflow**, não responsáveis (`lanes.js:4-22`); `assignee` é campo da issue (`:66`) | As raias **não são** raias-por-responsável neste projeto | O item 22 do doc (raia por responsável) **não corresponde** ao modelo atual |
| 8 | Sprint de destino = mudança de sprint | **ausente** | `jira-source.js:72` → `sprintId: null`; snapshot não traz sprint | Sem dado de sprint na origem | Sprint é **local** (`project-scrum-ops.js:100-107`), não Jira |
| 9 | Posição na lista = ordenação | **ausente** | Nenhum campo de `rank`/`position` no snapshot (`:45` lista os campos conhecidos) | Sem origem nem destino | Fora do escopo do MVP |
| 10 | Agrupamento visual ou filtro = campo editável | **ausente** | Filtros são de UI (`design-scrum-filters.js`, `design-scrum-filter-bar.js`) | Sem equivalente Jira | Filtro é **visual**, como o próprio doc admite (linha 26) |
| 11 | Múltiplos status por coluna | **parcial** | `project-scrum-resolver.js:13-27` mapeia N status → 1 raia (um por chave de status) | Mapeamento é **unidirecional**; falta raia → transição | Sem destino inequívoco para a escrita |
| 12 | Campos obrigatórios na transição | **não verificada** | — | Requer ler o *screen* de transição do Jira (campos obrigatórios por transição) | Bloqueia a escrita; exige chamada `transitions?expand=transitions.fields` **[Fato]**: não existe hoje |
| 13 | Autor efetivo = usuário do Harness | **ausente** | `createTransitionRecord` sem autor (`transitions.js:57-69`); app local com PIN (`config.js:137`) | Sem identidade de escrita, sem `actor` no histórico | Exige decisão de identidade antes da escrita |
| 14 | Permissões aplicadas | **ausente** | Sem escrita, logo sem autorização | Autorização do Jira está no token, não no app | Deve ser herdada do escopo do PAT, e auditada localmente |
| 15 | Auditoria: autor, issue, resultado, origem | **parcial** | `transitionHistory` grava issue, de→para, instante, origem (`:57-69`); visível em `design-scrum-story-drawer.js:62-64,125` | **Falta o autor** e o resultado do provedor | Auditoria incompleta para o critério do doc (linha 50) |
| 16 | Confirmar escrita / reconciliar após timeout | **parcial** | 409 com `currentLaneId` e recarregamento (`scrum-transition.controller.js:34-36`; `design-scrum-story-transition.js:34-41`) | O 409 é **local** (outra sessão), não é "timeout após sucesso remoto"; não há leitura de estado remoto para reconciliar | Falta o caso "resultado desconhecido" — o mais caro em escrita remota |
| 17 | Repetição não duplica alterações | **parcial** | Transições locais são idempotentes por construção: destino igual → erro (`:46`); transição gravada 1× por requisição | Sem chave de idempotência para o **provedor** | Relevante se a escrita passar a ser remota e retentável |
| 18 | Concorrência entre sessões | **existente (local)** | `SCRUM_STORY_CONFLICT` (`transitions.js:41-45`), `SCRUM_LANES_CONFLICT` (`ops.js:188-197`), escrita atômica (`persist.js:94`) | Vale para o estado **local**; não cobre duas instâncias do Harness nem o Jira | Deve ser reavaliado se houver escrita remota |
| 19 | Alternativa por teclado e fora do 3D | **existente** | Botões de passo `◀ ▶` (`design-scrum-story-card.js:44-45`) → mesmo `moveScrumStoryByStep`; foco restaurado após erro (`design-scrum-story-transition.js:44`); alvos de toque 44 px (`12-scrum-story-transitions.css:13-14`) | Não há paridade telão↔painel (`00-index.md:146`, 10.05 aberto) | O requisito do doc (linha 51) **já é satisfeito no painel** |
| 20 | Fluxo no mobile | **parcial** | `@media (max-width: 560px)` em `10-scrum-lanes.css:24`; 760 px em `09-scrum-story-details.css:81`; alvos grossos | Grade de colunas em tela estreita; escritório 3D é WebGL, não é caminho mobile | O painel é o caminho mobile; o 3D não |
| 21 | Estado de agente ≠ status de issue | **existente (por ausência)** | Nenhum caminho de código liga estado de agente a status de issue; `LANE_STATUS` (`transitions.js:6-19`) é a única tabela de status | — | O limite do doc (linha 37) está respeitado no código |
| 22 | Ferramenta MCP de Jira | **ausente** | Único MCP do Harness: `tools/permission-mcp.js`; `.mcp.json` do projeto: `dis-design-system` | Não existe servidor, nem anúncio de ferramentas, nem schema de Jira | Etapa 5 do doc depende de componente externo |
| 23 | Fila entre MCP e API | **não verificada** | — | Requer instância real e credencial | **Não é suposição**: MCP não é caminho de escrita do Harness hoje |
| 24 | UI chamando MCP no runtime | **não verificada / provavelmente inadequada** | MCP do Harness é stdio (`permission-mcp.js:6-8`); a UI fala HTTP com o servidor local (`router.js`) | — | Ver §4, alternativa D |
| 25 | Desativar escrita preservando a consulta | **ausente** | Não existe flag de escrita | — | Requer ser desenhado na primeira entrega de escrita |
| 26 | Idempotência do provedor | **não verificada** | — | Jira REST **não** garante idempotência de transição por padrão | Repetição deve ser tratada com chave local + reconciliação |

---

## 4. Comparação de alternativas

### Alternativa A — Evoluir a integração existente (snapshot → leitura viva) e adicionar um adaptador de escrita no backend

- **O quê:** manter `ui/server/services/project-scrum-*.js` como núcleo; acrescentar `ui/server/services/jira/` (cliente, config, transições, mapeamento); a regra de transição continua em `project-scrum-transitions.js`.
- **Benefícios:** reaproveita 100% do que já existe (12 raias, conflito 409, histórico, atomicidade, filtros, projeção 3D, testes); um único ponto de verdade da regra; menor superfície; sem processo novo.
- **Custos operacionais:** exige credencial do Jira no ambiente do Harness (decisão de segurança nova); polling/cache para não chamar o Jira a cada render; política de refresh e de staleness.
- **Riscos:** expor PAT a um processo de IA (mitigável: o token fica no servidor, nunca no prompt nem no `mcp.json` do agente); leitura inconsistente entre projeto e Jira (mitigável com `provenance`, que já existe).
- **Veredito:** **recomendada** como base.

### Alternativa B — Camada de operação compartilhada com entrada por UI e por MCP

- **O quê:** extrair a *operação* (mover história) para um caso de uso de aplicação, por exemplo `ui/server/services/scrum-operations/`, consumida pela rota REST (painel tradicional) e, depois, por um servidor MCP que **chama a mesma camada**.
- **Benefícios:** resolve a divergência de regras entre UI e agente; o MCP vira adaptador fino, não dono da regra; habilita a Etapa 5 do doc sem reescrever regras.
- **Custos operacionais:** mais uma camada e mais arquivos (a diretriz anti-monólito do `AGENTS.md:21-22` exige módulos coesos, o que é compatível, mas custa); reta final de integração a mais.
- **Riscos:** adiar sem ganho se o MCP não for usado; risco de over-engineering na Etapa 1.
- **Veredito:** **recomendada como destino**, entrada na Etapa 2, **não** na Etapa 1.

### Alternativa C — MCP de Jira de terceiros, usado pelo agente

- **O quê:** declarar um servidor MCP de Jira no `projects/<slug>/mcp.json` + `.mcp.json` do repo e deixar o agente escrever.
- **Benefícios:** zero código novo no Harness; entrega rápida de "escrever no Jira".
- **Custos operacionais:** dependência externa, versão não controlada pelo Harness; exige configuração por projeto e por máquina; a instalação já usa `--strict-mcp-config` (`engines/claude.js:113`), então o servidor precisa ser declarado explicitamente.
- **Riscos (graves):** o agente passaria a decidir transições **fora** da regra do Harness (12 raias, adjacência, raias ativas) — justamente a divergência que o doc quer evitar; o histórico de auditoria do Harness (`transitionHistory`) deixaria de ser a fonte; a política de idempotência e reconciliação ficaria a cargo do agente; **amplia o alcance de permissão do agente** a escrita remota.
- **Veredito:** **não recomendada** como caminho de escrita. Pode ser Mantida como *leitura* opcional, mas não como autor da regra.

### Alternativa D — A UI do Harness chamando o MCP em runtime

- **O quê:** o arrasto no painel (ou no telão) invoca um servidor MCP por stdio a cada operação.
- **Por que não faz sentido no runtime atual (resposta direta à pergunta 9 do doc):**
  1. O único MCP do Harness é **stdio** e responde a JSON-RPC no `stdout` (`tools/permission-mcp.js:6-8`) — não é um serviço com endereço. A UI conversaria com o servidor local via HTTP (`ui/server/router.js`); invocar o MCP exigiria **um processo novo por ação** (ou um supervisor), adicionando latência e um ponto de falha.
  2. O MCP do Harness existe para *autorizar o motor*, não para servir a UI: ele apenas pergunta "pode?" ao servidor e devolve a decisão (`tools/lib/permissions.js:5`). Reutilizá-lo como barramento de escrita inverteria o propósito.
  3. A regra continuaria precisando viver no Harness (as raias e as transições são do Harness). O MCP seria um **hop de serialização extra** entre a UI e a regra, sem ganhar nada.
  4. O ganho real da MCP é **dar a operação a um cliente externo** (o agente). A UI já tem a rota REST. Servir os dois com o mesmo caso de uso é o caminho — e aí o MCP fala **HTTP** com o servidor do Harness, não o contrário.
- **Veredito:** **não recomendada**.

### Comparação resumida

| Critério | A (evoluir) | B (operação compartilhada) | C (MCP de terceiros) | D (UI→MCP) |
|---|---|---|---|---|
| Reuso do que existe | Alto | Alto | Baixo | Médio |
| Regras única UI↔agente | Sim (a converge para b) | Sim | **Não** | Sim, mas com hop inútil |
| Custo operacional | Baixo–médio | Médio | Médio (dependência externa) | Alto (processo por ação) |
| Risco | Credencial no servidor | Camada extra | **Divergência de regra e alcance do agente** | Latência e falha |
| Caminho para a Etapa 5 (MCP) | Sim | **Sim, direto** | Trivial, mas errado | N/A |
| **Recomendação** | **Base** | **Destino** | Não, como escrita | Não |

---

## 5. Arquitetura candidata

```
┌───────────────────────────── FRONTEIRA DE ENTRADA ─────────────────────────────┐
│                                                                               │
│  Painel tradicional (2D)            Escritório 3D / telão                       │
│  design-scrum-sprint.js:58          war-screen-scrum.js (hoje: só desenha)     │
│  drag&drop + botões ◀ ▶             (Etapa 4: paridade, EP-10.05)              │
│            │                                    │                              │
│            └──────────────┬─────────────────────┘                              │
│                           │  POST /api/project/:slug/scrum/...  (REST, já existe)│
└───────────────────────────┼──────────────────────────────────────────────────┘
                            ▼
┌──────────────────── CAMADA DE OPERAÇÃO (nova, destino da Etapa 2) ───────────┐
│                                                                               │
│  scrum-operations/           ← caso de uso: "mover história"                  │
│    moveStory(...)  { origem, issue, laneDe, lanePara, confirmar?, syncTarget? }│
│    readScrum(...)                                                        │
│                                                                               │
│  Regras EXISTENTES a preservar/reusar:                                       │
│    project-scrum-transitions.js:26-55  (adjacência, raias ativas)             │
│    project-scrum-lanes.js:4-22           (catálogo de 12 raias)                │
│    project-scrum-ops.js:84-98            (gravação + histórico + conflito)    │
│    scrum-transition.controller.js:34-36 (409 + currentLaneId)                 │
│                                                                               │
│  NOVO: resolvedor de destino  lane → transição de Jira (tabela explícita)     │
└───────────┬──────────────────────────────────────────────────────┬────────────┘
            │                                                      │
            ▼                                                      ▼
┌──────────────────────┐                        ┌───────────────────────────────┐
│ ESTADO LOCAL         │                        │ ADAPTADOR JIRA (novo)         │
│ projects/<slug>/     │                        │ jira/client.js  (REST v2)     │
│   scrum.json         │                        │ jira/transitions.js (ler)     │
│ transitionHistory    │                        │ jira/mapper.js (lane→status)  │
│ (com autor + resultado)│                      │ jira/identity.js (PAT, escopo)│
└──────────────────────┘                        └───────────────────────────────┘
                                                       │
                                                       ▼
                                        Jira (Server/DC, REST v2)  ← não verificado
                                                       │
┌──────────────────────┐        ┌───────────────────────────────────────────────┐
│ MCP (Etapa 5)        │───────▶│ fala HTTP com o servidor do Harness          │
│ ferramentas Jira     │        │ (mesmo caso de uso; NÃO é dono da regra)      │
│ declared em mcp.json │        └───────────────────────────────────────────────┘
└──────────────────────┘
```

**Autoria das ações (quem decide o quê):**

| Decisão | Dono | Onde mora |
|---|---|---|
| Quais raias existem e em que ordem | Harness (produto) | `project-scrum-lanes.js` |
| Se uma transição é permitida | Harness (produto) | `project-scrum-transitions.js` |
| Qual status do Jira corresponde a uma raia | **Configuração do Jira** (não código) | Tabela explícita, administrada, versionada no `scrum.json` |
| Se a transição existe no workflow da issue | Jira | `GET /rest/api/2/issue/{key}/transitions` **[Fato]**: não lido hoje |
| Quem executa a escrita | UI (painel) ou agente (MCP) | Entrada; ambos chamam o mesmo caso de uso |
| Quem é o autor efetivo | Identidade do token do Jira + `actor` local | A definir (pendência de produto) |

**Contratos PROPOSTOS (novos) vs. EXISTENTES (confirmados):**

| Contrato | Situação | Assinatura |
|---|---|---|
| `POST /api/project/:slug/scrum/story/transition` | **existente** | `{ storyId, fromLaneId, toLaneId }` → `{ ok, scrum }` \| 400 \| **409** `{ error, currentLaneId }` (`scrum-transition.controller.js:27-37`) |
| `GET /api/project/:slug/scrum` | **existente** | → `{ ok, slug, scrum }` com `stories`, `lanes`, `lanesRevision`, `storyTransitions`, `sourceStatuses`, `transitionHistory`, `summary` (`project-scrum-persist.js:73`) |
| `GET /api/project/:slug/scrum/jira/transitions?storyId=` | **proposto** | `{ storyId }` → `{ available, transitions: [{ id, name, toStatusId, toStatusName, requiredFields: [] }], source }` |
| `GET /api/project/:slug/scrum/jira/mapping` / `POST` | **proposto** | tabela `laneId → { jiraStatusId, jiraStatusName, jiraTransitionId? }`, validada contra `isLaneId` (`project-scrum-lanes.js:75`) |
| `POST /api/project/:slug/scrum/story/transition` **estendido** | **proposto** | `+ syncTarget: "local" \| "jira" \| "jira-dry-run"`, `+ expectedJiraStatus` (concorrência remota), resposta `+ sync: { status, jiraStatus, reconciled, actor }` |
| Ferramenta MCP `jira_move_story` | **proposto (Etapa 5)** | parâmetros mínimos (`storyId`, `toLaneId`, `confirmar`); **chama a rota HTTP do Harness**, não o Jira direto |

**Regra de ouro que a arquitetura impõe:** *nenhum* mapeamento de destino pode ser derivado do nome visível da coluna. O destino Jira vem da tabela explícita; se a tabela não tiver a raia, a operação **não escreve** e explica o motivo.

---

## 6. Plano incremental

Sem estimativas de prazo: a ordem importa, a duração depende de decisões ainda abertas (§10).

### Etapa 0 — Preparação (sem código de produto)

**Objetivo:** remover bloqueios de informação antes de escrever qualquer linha de escrita.
**Arquivos prováveis:** `docs/harness-jira/02-mapa-lane-status.md` (novo, documentação), `ui/server/services/project-scrum-lanes.js` (somente se for preciso expor metadados de lane já existentes).
**Dependências:** acesso de leitura ao Jira (PAT de leitura, escopo mínimo) para ler `transitions` por issue; confirmação de variante (§10.1).
**Aceitação:** uma tabela `laneId → status Jira` (quando existir) e `laneId → transição` (quando existir) preenchida a partir da instalação real, com a lista de **raias sem destino Jira** explicitada. Transições que o Jira **não** oferecer ficam documentadas como "sem escrita possível".
**Validação:** conferência manual da tabela contra 3–5 issues reais de cada status.

### Etapa 1 — Leitura viva (recomendação de primeira entrega) **[REVER — já implementada na árvore de trabalho em 21/10/2026 17:05-17:24, sem commit; ver §0]**

**Objetivo:** substituir o snapshot manual por consulta ao vivo, **mantendo o snapshot como fallback** (não quebrar o projeto quando o Jira estiver indisponível).
**Arquivos prováveis (novos, coesos, < 250 linhas cada, conforme `AGENTS.md:21-22`):**
- `ui/server/services/jira/jira-client.js` — HTTP, `Authorization`, timeout, retry **sem** retry automático em escrita, `redact` de erro.
- `ui/server/services/jira/jira-config.js` — URL/credencial da **variável de ambiente** (nunca em arquivo versionado; `global/.env` já é o padrão do repo).
- `ui/server/services/jira/jira-issue-source.js` — normaliza a resposta da API no **mesmo formato** de `normalizeJiraSnapshot` (`project-scrum-jira-source.js:80-102`) — reaproveitar o normalizador, não reescrever.
- `ui/server/services/jira/jira-cache.js` — cache com TTL curto, expondo `exportedAt`/staleness para a UI.
- Alteração: `ui/server/services/project-scrum-persist.js:64-74` — escolher fonte viva > snapshot; manter `source: "jira-snapshot"` → novo `source: "jira-live"` **sem quebrar** `provenance` (`project-scrum-resolver.js:53-64`) nem o teste `tests/project-scrum-sources.test.js`.
- Alteração: `ui/public/js/modules/design-scrum-story-drawer.js:112` — rótulo da origem ("Jira + documentação local" → "Jira ao vivo + documentação local") e indicador de desatualização.
**Dependências:** Etapa 0; decisão de segurança sobre credencial (fora do repositório, fora do prompt do agente).
**Aceitação:** com o Jira acessível, `GET /api/project/:slug/scrum` devolve as mesmas chaves de hoje, com `source` indicando origem e um carimbo de desatualização; com o Jira **indisponível**, o endpoint **continua respondendo** a partir do snapshot e sinaliza `stale: true` — nenhuma regressão no painel nem na projeção 3D.
**Validação:** `npm test` verde; novo `tests/jira-client.test.js` com respostas controladas (200, 401, 403, 404, 429, timeout, JSON inválido); teste de "Jira fora → fallback" com o snapshot presente.

### Etapa 2 — Caso de uso de operação + destino explícito (seco)

**Objetivo:** criar a camada de operação compartilhada e **simular** a escrita, sem escrever.
**Arquivos prováveis:**
- `ui/server/services/scrum-operations/move-story.js` (novo) — encapsula a chamada a `moveStoryToLane` + resolução de destino Jira + `dryRun`.
- `ui/server/services/scrum-operations/jira-destination.js` (novo) — resolve `laneId → destino Jira` pela tabela explícita; **recusa** quando não há destino.
- `ui/server/services/jira/jira-transitions.js` (novo) — lê e cacheia as transições por issue.
- Alteração: `ui/server/controllers/scrum-transition.controller.js` — aceita `syncTarget` e devolve `sync`.
- Alteração: `ui/server/services/project-scrum-ops.js:57-69` — **adicionar `actor` e `result`** ao registro de transição (campo ausente hoje; §2.3).
**Dependências:** Etapa 1 e Etapa 0.
**Aceitação:** para uma transição com destino Jira conhecido, a resposta traz o **plano** (`{ de, para, lane, jiraStatus, transitionId, camposObrigatorios, dryRun: true }`); para uma raia sem destino, vem **recusa explicada** e **nada é gravado**; para uma transição que o Jira não permite, idem.
**Validação:** testes de unidade do resolvedor (12 raias × 9 status × estados do mapa), teste do adaptador com respostas controladas, teste de recusa.

### Etapa 3 — Escrita de **uma** transição, atrás de flag

**Objetivo:** gravar de fato **uma** transição de status no Jira, com auditoria e reconciliação.
**Arquivos prováveis:**
- `ui/server/services/jira/jira-write.js` (novo) — `POST` de transição, **sem** retry automático; classifica falha em: *falha confirmada* (4xx de validação, 403) vs. **resultado desconhecido** (timeout/5xx após envio).
- `ui/server/services/scrum-operations/reconcile.js` (novo) — em resultado desconhecido, **lê o estado** e decide: já aplicado (idempotente), não aplicado (permite repetir), ou divergente (alerta).
- `ui/server/services/jira/jira-identity.js` (novo) — escopo do token, identidade efetiva, redação de erro.
- Alteração: `ui/server/services/project-scrum-ops.js` — gravar `actor`/`result`/`jiraStatus` no histórico.
- Feature flag: `JIRA_SYNC_ENABLED` (variável de ambiente) — **desligada por padrão**; desligar a escrita **preserva a leitura** (a Etapa 1 não depende da flag).
**Dependências:** Etapa 2; decisão de identidade (§10.3).
**Aceitação:** mover para uma raia com destino Jira **gravou no Jira** e o card reflete o estado confirmado; falha confirmada mostra mensagem específica e **o card não fica em sucesso fictício**; resultado desconhecido dispara reconciliação e **não** duplica; a transição fica no histórico com autor, origem (`ui` | `mcp`) e resultado.
**Validação:** integração contra o Jira de teste com respostas controladas (sucesso, 401, 403, 400 de campo obrigatório, 409, timeout pós-envio, 5xx); teste de idempotência: repetir a mesma transição não cria duplicata.

### Etapa 4 — Paridade do telão (EP-10.05)

**Objetivo:** o telão 3D passa a **operar** o mesmo caso de uso, com paridade de teclado e leitura de estado.
**Arquivos prováveis:** `ui/public/js/office3d/war-screen/war-screen-scrum.js` (picking de card/raia), `ui/public/js/office3d/war-screen/war-screen-scrum-interaction.js` (novo), `ui/public/js/office3d/pointer-controller.js`, `ui/public/js/office3d/interaction-manager.js`, `ui/public/js/office-state.js`.
**Dependências:** Etapa 3.
**Aceitação:** arrastar no telão produz **a mesma** operação que arrastar no painel (mesmo endpoint, mesma regra); falha no Jira reflete no telão; a projeção continua somente leitura **quando a escrita está desligada**; o fluxo é acessível por teclado (mesmo padrão `◀ ▶` já existente no painel) e não regride o modo 2.5D.
**Validação:** testes do modelo de interação (projeção pura) + aceite manual em navegador nos 3 modos (a suíte do escritório é majoritariamente manual — §2.9).

### Etapa 5 — MCP de operações

**Objetivo:** expor a operação a agentes por MCP, **reusando o caso de uso**.
**Arquivos prováveis:** `tools/scrum-mcp.js` (novo, stdio, no padrão de `tools/permission-mcp.js`), `tools/lib/project-mcp.js` (registro), `projects/<slug>/mcp.json` (declaração, **na máquina**, fora do Git).
**Dependências:** Etapa 3 (ou 4) estável e medida.
**Aceitação:** a ferramenta MCP `mover_historia` produz **o mesmo** registro de auditoria que a UI; **não** possui regra própria; recusa a transição que a UI recusaria; a política de permissão do motor (`tools/lib/permissions.js`) cobre a chamada; a operação MCP é auditada com `origin: "mcp"`.
**Validação:** teste do servidor MCP por JSON-RPC (o padrão de `tests/permissions.test.js:180-281`); teste de paridade UI↔MCP (mesma transição, mesmo resultado).

### Etapa 6 — Contexto e casos de uso incrementais

**Objetivo:** associação issue↔execução, comentários preparáveis, criação de issue com prévia.
**Dependências:** Etapa 3 (escrita) + decisão de produto.
**Nota:** a Etapa 6 do doc ("Contexto") está fora do caminho crítico e **não** deve preceder a escrita de uma transição bem definida, conforme o critério do próprio doc (linha 54).

---

## 7. Estratégia de testes

Adaptação às ferramentas já existentes no repositório (`node --test`, padrão `tests/*.test.js`; suíte atual com 875 testes verdes).

| Nível | O que testar | Ferramenta existente | Arquivo provável |
|---|---|---|---|
| **Unidade — mapeamento** | `laneId → destino Jira`; raias sem destino; status ambíguos; `Cancelado` vs `Concluído` | `node --test` | `tests/jira-destination.test.js` |
| **Unidade — regras** | Adjacência, raias inativas, conflito de sessão, revisão de raias (já cobertos) | `node --test` | `tests/project-scrum-transitions.test.js` (existente) |
| **Unidade — normalização** | Resposta da API → mesmo formato do snapshot; campo obrigatório ausente; epic link; assignee | `node --test` | `tests/project-scrum-sources.test.js` (existente) |
| **Integração do adaptador** | Cliente contra **respostas controladas** (nunca o Jira real): 200, 401, 403, 404, 409, 429, 5xx, timeout, JSON inválido, paginação | `node --test` + servidor local de fixture | `tests/jira-client.test.js` |
| **Integração — escrita** | Transição aceita; recusa de transição inexistente; campo obrigatório ausente; **timeout após sucesso** | `node --test` + fixture | `tests/jira-write.test.js` |
| **Fluxo de interação (UI)** | Arrasto e `◀ ▶` produzem a mesma chamada; 409 recarrega e foca; estado de pendência durante a escrita | `node --test` sobre o módulo (padrão de `tests/design-scrum-transitions.test.js`) | `tests/design-scrum-sync.test.js` |
| **Permissões** | Escrita sem flag → recusada; escrita com flag → permitida; destino sem permissão no Jira → erro específico, sem escrita local | `node --test` | `tests/jira-permissions.test.js` |
| **Timeout após sucesso** | Envia, o provedor aplica, a resposta se perde → reconciliação lê o estado → **não** repete | `node --test` + fixture com atraso | `tests/jira-reconcile.test.js` |
| **Concorrência** | Duas sessões movendo a mesma história → uma vence, a outra recebe 409 (já coberto localmente; **repetir com escrita remota**) | `node --test` | estender `tests/project-scrum-transitions.test.js` |
| **Reconciliação** | Divergência entre estado local e Jira → sinalizada, não sobrescrita em silêncio | `node --test` | `tests/jira-reconcile.test.js` |
| **Regressão do 3D** | Projeção do telão inalterada; paridade das regras; fontes e Provenance preservados | `node --test` | `tests/war-screen-projection.test.js` (existente) |

**Regras que os testes devem fixar (derivadas dos critérios de aceite do doc, linhas 46-51):**
1. Nenhum destino derivado do nome visível da coluna.
2. A ação termina em **estado confirmado** ou **mensagem de falha**; nunca "sucesso fictício".
3. Campo obrigatório ausente e transição indisponível produzem mensagem compreensível.
4. Repetição não duplica.
5. O registro contém autor, issue, resultado e origem.
6. O mesmo comportamento é acessível por teclado e fora do 3D.

**Não executar** (conforme o prompt): testes de integração contra o Jira real, ou qualquer teste que escreva em serviço real. As fixtures acima são **sempre** locais.

---

## 8. Ativação e rollback

### Chave de controle

Uma única variável de ambiente, **`JIRA_SYNC_ENABLED`**, com três estados:

| Estado | Leitura | Simulação (dry-run) | Escrita no Jira | Fila local |
|---|---|---|---|---|
| `false` (padrão) | ✅ viva ou snapshot | ❌ | ❌ | apenas transições locais existentes |
| `dry-run` | ✅ | ✅ | ❌ | registra a **intenção** |
| `true` | ✅ | ✅ | ✅ | registra a transição **aplicada** |

**[Proposta]** A desativação da escrita **preserva a consulta** porque a leitura (Etapa 1) não depende da flag — é o requisito do doc (linha 54) e o motivo de a leitura vir **antes** da escrita.

### Rollback

| Camada | Como reverter | Observação |
|---|---|---|
| **Código** | Reverter os commits da Etapa 2/3; o `scrum.json` continua legível (o formato não muda — apenas ganha campos) | O `scrum.json` é dado local, não é revertido por código |
| **Flag** | `JIRA_SYNC_ENABLED=false` → escreve-se nada; a leitura segue | Reversão imediata, sem deploy |
| **Estado local** | O `transitionHistory` **não** é apagado: as transições já aplicadas no Jira são fatos e precisam ficar auditáveis | Manter o histórico, mesmo após desligar a flag |
| **Efeito no Jira** | ⚠️ **Reverter no Jira exige operação válida e auditada** — mover o card de volta visualmente **não** desfaz o workflow | Confirma a ressalva do doc (linha 54); a UI deve **avisar** que arrastar de volta não reverte no Jira |
| **Desfazer no Jira** | Requer a transição inversa **existir no workflow** — **não verificada**. Se não existir, o Harness **não pode** reverter sozinho | Bloqueio a resolver na Etapa 0: mapear transições de retorno |
| **Sincronização** | Com a escrita desligada, o quadro local e o Jira divergem. A UI **deve** mostrar a divergência (`provenance` + `sync.lastSyncedAt`) | Reconciliação é leitura, não escrita — funciona mesmo com a flag desligada |

**Regra de não-destruição:** o Harness nunca executa transição de reversão no Jira sem confirmação explícita do usuário e sem registro de auditoria. A reversão automática após falha parcial é proibida (resultado desconhecido → **consultar**, não repetir nem reverter).

---

## 9. Backlog inicial priorizado

### MVP (Etapas 0–3)

| # | Item | Prioridade | Depende de | Entregável |
|---|---|---|---|---|
| M1 | Tabela `laneId → status/transição Jira` preenchida da instalação real | P0 | — | Doc + dado versionado |
| M2 | Leitura viva do Jira com fallback para o snapshot e sinalização de staleness | P0 **[REVER: feito]** | M1 | `jira/*` + `jira-client.test.js` |
| M3 | Leitura de transições por issue (`GET .../transitions`) | P0 | M2 | `jira-transitions.js` + teste |
| M4 | Resolvedor de destino com recusa explícita e modo dry-run | P0 | M1, M3 | `scrum-operations/jira-destination.js` |
| M5 | Autor e resultado no histórico de transições | P0 | — | `project-scrum-transitions.js` + teste |
| M6 | Escrita de **uma** transição, atrás de `JIRA_SYNC_ENABLED`, com classificação falha/resultado desconhecido | P0 | M4, M5 | `jira-write.js` + `jira-write.test.js` |
| M7 | Reconciliação pós-resultado-desconhecido (releitura, sem repetição cega) | P0 | M6 | `scrum-operations/reconcile.js` + teste |
| M8 | Exibição de origem e desatualização na UI | P1 | M2 | `design-scrum-story-drawer.js` |
| M9 | Duplicata/visibilidade de transição de retorno ausente | P1 | M3 | UI avisa "reverter no Jira não é garantido" |

### Evolução (Etapas 4–6)

| # | Item | Prioridade | Depende de |
|---|---|---|---|
| E1 | Paridade do telão 3D com o painel (EP-10.05) | P1 | M6 |
| E2 | Ferramenta MCP de operação (reusando o caso de uso) | P2 | M6 medido |
| E3 | Associação issue ↔ execução persistida | P2 | decisão de produto |
| E4 | Comentários preparáveis para revisão antes do envio | P2 | M6 |
| E5 | Criação de issue a partir de conversa, com prévia | P3 | M6 |
| E6 | Sprint, ordenação e responsável como operações Jira | P3 | §10.2 (dados ausentes no snapshot) |
| E7 | Métricas do piloto (tempo de consulta, taxa de falha, divergências) | P1 | M6 |

### Títulos de commits (Conventional Commits) e resumo de PR da **primeira entrega** (M2 + M8)

> Nenhum commit ou PR foi criado nesta rodada.

Commits sugeridos, em ordem:

```
refactor(scrum): separa leitura de origem do estado local do quadro
feat(scrum): adiciona cliente de leitura do Jira com cache e fallback
feat(scrum): sinaliza a origem e a desatualizacao dos dados no quadro
test(scrum): cobre cliente do Jira com respostas controladas e fallback
```

**Resumo de PR (primeira entrega — "Leitura viva do Jira com fallback para o snapshot"):**

> **Objetivo.** Substituir a dependência de um snapshot manual do Jira por consulta ao vivo, sem quebrar o comportamento atual quando o Jira está indisponível.
>
> **O que muda.** Novo `ui/server/services/jira/` (cliente, configuração, cache, fonte de issues) que reutiliza o normalizador já existente (`normalizeJiraSnapshot`), de modo que a forma dos dados não muda. `project-scrum-persist.js` passa a preferir a fonte viva e a cair para `doc/scrum/_jira-dis.json` quando a rede falhar, expondo `stale` e `lastSyncedAt` no payload do Scrum. A UI passa a mostrar a origem dos dados e um aviso de desatualização.
>
> **Por quê.** Todo o restante do plano (ler transições, simular e gravar uma transição) depende de uma leitura viva confiável. Esta entrega não escreve no Jira, não altera regras de transição, não muda raias e não toca no escritório 3D.
>
> **Como validar.** `npm test` (875 testes verdes no baseline) e a nova suíte `tests/jira-client.test.js` com respostas controladas (200/401/403/404/429/timeout/JSON inválido) e o cenário de fallback. Nenhum teste toca o Jira real.
>
> **Risco e reversão.** O risco é de disponibilidade, não de dados: no pior caso o quadro volta ao comportamento de hoje (snapshot) com o aviso de desatualização. A reversão é o revert do commit; o `scrum.json` não muda de formato.
>
> **Pendente de decisão.** Onde a credencial do Jira vive no ambiente (recomendação: variável de ambiente no servidor, nunca no repositório nem no contexto do agente) — ver §10.4.

---

## 10. Perguntas pendentes ao PM (somente o que o código e a configuração não responderam)

**10.1 — Variante e contratos do Jira. [REVER: variante CONFIRMADA — Jira Server/Data Center, REST v2; ver §0] A pergunta restante é mais estreita: a lista real de transições por status, se existe transição de retorno e quais campos cada transição exige.** *Impacto:* sem isso, a tabela de destinos e o rollback ficam incompletos.

**10.2 — Semântica dos destinos.** O documento executivo prevê "raia por responsável" e "sprint de destino" como operações distintas. No código, as 12 raias são **etapas de workflow** (`project-scrum-lanes.js:4-22`) e o snapshot **não traz sprint** (`project-scrum-jira-source.js:72`). Confirma-se que, no escopo do MVP, os únicos destinos em jogo são **etapa/status** — e que responsável, sprint e ordenação ficam para a evolução?

**10.3 — Identidade e autoria.** Quem é o "autor efetivo" no Jira: o dono do PAT, ou o operador identificado? E o histórico local deve gravar o autor (hoje não grava)? Se houver mais de um operador na máquina, é preciso decidir se o Harness passa a identificar quem opera. *Impacto:*requirement de auditoria (critério do doc, linha 50) e permissões.

**10.4 — Política de credencial.** Onde o token do Jira pode viver: variável de ambiente do servidor do Harness (recomendado), ou gerenciador de segredos? O Harness hoje **não** tem nenhum segredo de Jira — introduzi-lo é uma decisão de segurança, não um detalhe de implementação. Também: leitura apenas, ou leitura+escrita desde o primeiro token?

**10.5 — Escopo de escrita.** Aprovamos gravar **no Jira** de verdade, ou o MVP para em leitura + simulação, com a escrita condicionada a um piloto controlado? *Impacto:* define se a Etapa 3 entra no MVP.

**10.6 — Semântica de "Concluído" × "Cancelado".** Hoje ambos caem em `done` e o modelo não distingue entrega de cancelamento (§2.6). Deve-se criar um destino "Cancelado" no quadro local, ou aceitar a perda? *Impacto:* integridade do quadro e da métrica de conclusão.

**10.7 — Onde a experiência principal do usuário deve morar.** O caso de uso **central** do documento é o arrasto **no telão 3D**, mas o telão é somente leitura por decisão de produto (EP-05.06) e o quadro interativo é o painel tradicional, que já é alcançável do 3D pelo quadro branco. Confirmar a prioridade: (a) painel tradicional primeiro (recomendado: já tem arraste, teclado, conflito e auditoria) e telão depois por paridade, ou (b) telão como prioridade, aceitando construir arraste em canvas do zero.

**10.8 — Escopo de 12 raias × 9 status.** Confirmar se o quadro local de 12 etapas deve **manter-se** como o modelo canônico (e o Jira apenas ser sincronizado por uma tabela), ou se o quadro deve passar a refletir o workflow real do Jira (9 status). *Impacto:* determines se a Etapa 2 é uma tabela de mapeamento (barata) ou uma migração de modelo (cara). **[REVER: o snapshot regerado tem 10 status; a pergunta segue aberta, e o número de status é móvel]**

**10.9 — Política de dados do snapshot.** 199 issues têm comentários, e neles há **CPF de paciente**, nome, e-mail e telefone de servidores (ver §0). Confirma-se que: (a) comentários **não** devem chegar a modelo externo; (b) o escopo de `tools/jira-query.js` deve ser o único caminho para o agente ler Jira; (c) a redação de CPF/CNS/e-mail/telefone deve ser **obrigatória**, sem `--raw` liberado para uso com modelo? *Impacto:* define se a Etapa 5 (MCP) pode existir neste projeto de saúde — um MCP de Jira que devolva comentários a um agente em nuvem é, hoje, **um problema de LGPD**, não uma questão de arquitetura.

---

## Encerramento — recomendação da primeira etapa

**Etapa 1 — Leitura viva do Jira com fallback para o snapshot, junto com a Etapa 0 (tabela de destinos vinda da instalação real), e sem nenhuma escrita no Jira.**

Rationale, em uma frase: é a única entrega que **acrescenta** capacidade verificável ao Harness sem introduzir credencial de escrita, sem duplicar regra e sem depender de decisão de produto ainda aberta — e sem ela, nenhuma das Etapas 2 a 5 pode ser implementada com honestidade.

**Divergências em relação ao documento executivo** (o doc pede explicitamente que sejam explicadas):

1. **"Arraste no telão" como caso de uso central → recomendado como Etapa 4, não como primeira entrega.** O telão é canvas sem interação (`war-screen-scrum.js:93-136`) e a EP-05.06 o define como somente leitura; construir arraste em canvas custa caro e, antes disso, o painel tradicional já entrega o mesmo gesto com teclado, conflito e auditoria. A paridade está declarada como pendente (EP-10.05), o que confirma a ordem.
2. **"Comando por conversa → agente → ferramenta MCP → mesma operação" → mantido como destino, não como Etapa 1.** O MCP entra **depois** que a operação existir e estiver medida; e o MCP falará **HTTP** com o servidor do Harness, não o inverso (§4, alternativa D).
3. **"A API é a interface do Jira usada para consultar ou gravar dados" → hoje, no Harness, não existe API de Jira.** Existe um snapshot local. A distinção do doc é correta; a premissa de que já existe integração é o que muda (§2.4, §2.5).
4. **"Mover uma história no telão" como Etapa 3 do doc → reordenada para depois da consulta viva e da tabela de destinos**, porque sem uma transição **conhecida e inequívoca** do Jira o destino do arrasto é ambíguo — exatamente o risco que o próprio doc sinaliza (linhas 11, 21-27).
5. **Nenhuma estimativa de prazo** é apresentada, e nenhum objetivo de ROI foi fixado: o próprio doc reconhece que os benefícios são hipóteses a medir (linha 18) e que a linha de base deve ser medida antes do piloto (linha 56).
