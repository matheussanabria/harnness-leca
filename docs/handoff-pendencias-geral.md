# Handoff Consolidado de Pendências (Para Próximo Motor / Agente)

> **Data de Atualização:** 2026-10-25  
> **Estado do Repositório:** `main` consolidado (último merge `9009dec`), sem branches divergentes pendentes de código principal.  
> **Fontes Canônicas:**  
> - Épicos & Gaps: `docs/harness-evolution/00-index.md` e `docs/harness-evolution/05-progress/epic-gaps.md`  
> - Telemetria: `docs/harness-telemetria/10-handoff-pendencias.md` e `00-plano-consolidado.md`  
> - Ateliê (Design Pilot): `docs/atelie-pilot/04-revision-rounds.md`  
> - Mapa de Arquivos: `MAPA.md` e `docs/mapa/*.md`

---

## 1. Regras de Execução para Motores (Obrigatórias)
1. **Regra de Worktrees e Isolamento:** Nunca trabalhar diretamente na pasta raiz do repositório principal `c:/Users/matheuss.rodrigues/git/harness-leca` para implementações. Criar uma worktree isolada:
   ```bash
   git worktree add C:/Temp/hl-<nome-da-tarefa> -b <nome-da-branch> main
   ```
2. **Commit e Merge:** O usuário realiza a aprovação e o merge no `main` (existe hook de bloqueio em `main`). Prepare os comandos claros e commits atômicos em sua branch.
3. **Limites de Arquivo & Padrão Visual:**
   - Limite estrito de 250 a 300 linhas por arquivo (anti-monólito). Submódulos focados e SRP.
   - **Proibição absoluta de emojis** na UI e no código. Usar apenas **FontAwesome** (`fa-solid` / `fa-regular`).
   - Manter `docs/mapa/*.md` atualizado para qualquer arquivo criado, movido ou renomeado.
4. **Alocação de Modelos:**
   - Tarefas pesadas/código: modelos gratuitos do OpenCode (`opencode/deepseek-v4.1-flash-free`, `opencode/glm-5.3-flash-free`, `beam-free` para saídas longas de design) ou Gemini.
   - Claude: apenas planejamento/revisão (preservar cotas).

---

## 2. Visão Geral das Três Frentes de Pendências

### Frente A: Backlog dos Épicos de Evolução (`docs/harness-evolution/00-index.md`)
*16 histórias pendentes de finalização no índice:*

| Épico | Histórias Pendentes | Detalhes / Observações |
|---|---|---|
| **EP-09** | 09.02, 09.04, 09.05, 09.06 | `09.02` (event log e SSE) foi em grande parte construído pelo programa de telemetria; reconciliar status com o índice. `09.04` (navegação/retomada), `09.05` (atenção e aprovações) e `09.06` (monitor de motores) aguardam continuidade. |
| **EP-11** | 11.04, 11.05 | `11.04` (Design System e inconsistências visuais), `11.05` (regressão automatizada e cobertura de testes reais). |
| **EP-13** | 13.01 a 13.09 (Todas as 9) | Programa de Memória Curada e Conhecimento dos Agentes (contrato de item de memória, índice gerado, ferramenta `save`, migração/deduplicação, carregamento 2 fases, colheita e faxina periódica). |
| **EP-14** | 14.11 | Fechamento formal do EP-14: verificação manual F5 sobre as 13 telas, documentação e sincronização com MAPA. |

---

### Frente B: Gaps Identificados na Auditoria de Código (`epic-gaps.md`)
*Contratos aceitos no backend/testes, porém com UI pendente ou não conectada:*

1. **EP-01 & EP-04 (Window Manager e Workspaces):**
   - História `01.11` (fiação da fachada do Window Manager no escritório) precisa de validação em navegador.
   - História `01.12` (host multi-janelas e docking integrado) não iniciada.
   - Templates e persistência de workspaces (`windowManager.workspaces.*`, `windowManager.persistence.*`) não possuem chamadores na UI.
2. **EP-08 (Agentes & Workflows):**
   - História `08.06` (Aba Workflows no orquestrador) precisa de validação visual em navegador.
3. **EP-03 (Escritório 2.5D/3D):**
   - História `03.04` permanece em aberto; foco de tela no modo 2.5D (`lastScreenFocus`) é escrito mas nunca renderizado.
4. **EP-09 (Observabilidade):**
   - Descoberta atual suporta apenas sessões Markdown; `POST /sessions/scan` existe no backend mas não há trigger/botão na UI para disparar o scan.
5. **EP-11 (Auditoria e Qualidade):**
   - Execução de BDD executa `npm test` genérico em vez do artefato de teste gerado (`.feature`).
6. **EP-12 (Prototype Engine):**
   - Piloto `dis-modular` está em `.trash`, serviços Studio e `proto.json` sem rotas no servidor e sem baseline. Decisão de produto: restaurar ou descartar formalmente o piloto.
7. **EP-00 & EP-02 (Arquitetura e Chat):**
   - Evidências de auditoria de commits antigos não são reproduzíveis; Office ainda não tem apresentação nativa de chat (usa iframe da Central).
8. **Transversal & Qualidade de Código:**
   - ~190 linhas com emojis residuais em `ui/public` (deploy, groups, skills, inspector etc.).
   - `studio.html` (em `ui/public/partials/studio.html`) possui ~433 linhas (excede o teto de 300 linhas).
   - Reconciliação do `00-index.md`: adicionar `01.11`, `01.12` e `08.06` à listagem formal do índice.

---

### Frente C: Programa de Telemetria (`docs/harness-telemetria/10-handoff-pendencias.md`)

#### P0 — UI da Aba "Sessões" (Feedback Direto do Usuário)
- **Localização:** Central de Orquestração, aba "Sessões" (`ui/public/js/office3d/orchestration/central-sessions-*.js`, estilos em `ui/public/css/office/`).
- **Problemas Visuais Identificados:**
  - Grade de texto simples sem alinhamento: colunas colidem (Workflow, Execução, Atenção, Origem), sem separação entre linhas, texto transborda.
  - Título da sessão concatena nome, id e short-id sem hierarquia (`claude e108ead2 claude:e108e`).
  - Filtros são selects nativos sem estilo; busca e botão "Atualizar" sem estilo.
  - Valores neutros ("Sem workflow", "Atividade desconhecida", "Sem sinal recente", "Sem atenção") dominam as linhas e poluem a visão.
  - Dock flutuante sobrepõe as linhas inferiores.
- **Diretriz de Design:** Reutilizar o padrão visual moderno da aba "Consumo" (`20-usage-panel.css`, tokens de tema dark, cards/linhas estruturadas, badges FontAwesome, chips/filtros estilizados, valores neutros atenuados).

#### P1 — Limpeza e Manutenção
1. **Worktrees órfãs:** Confirmar com o usuário a remoção das worktrees finalizadas `C:/Temp/hl-tmpleak` e `C:/Temp/hl-mapsplit` (`git worktree remove`).
2. **Limpeza de `%TEMP%`:** Executar limpeza definitiva via script (após dry-run prévio de ~4.360 itens).
3. **Stashes:** Avaliar com o usuário o descarte do stash `correcao-open-code` (já integrado).
4. **Arquivos residuais em `C:/Temp`:** Limpar `oc-prompt-*` e `oc-run-*.log`.

#### P2 — Acompanhamentos Técnicos
- Revisão de preços oficiais em `tools/lib/pricing/prices.json`.
- Confirmação formal da política de retenção (`usage.observed`: 180 dias ou 200.000 eventos).
- `tools/import-legacy-telemetry.js`: executar com `--apply` após aprovação do usuário.
- Validação da detecção de portas OpenCode contra processo real `opencode serve`.
- Modularização de `ui/server/services/events/event-projector.js` (atualmente com ~272 linhas, teto 250).
- Formalização dos ADRs ADR-TEL-001 a ADR-TEL-007.

---

## 3. Ordem de Execução Recomendada para o Próximo Motor

1. **[P0 - UI/UX] Redesenho da Aba Sessões:** Criar worktree (`hl-sessions-ui`), refatorar apresentação em cards/badges reutilizando tokens da aba Consumo, mantendo arquivos < 300 linhas e testes de UI.
2. **[Bookkeeping] Atualização do Índice:** Adicionar `01.11`, `01.12` e `08.06` ao `00-index.md` e reconciliar a entrega de `09.02`.
3. **[Verificação de Navegador] 01.11 e 08.06:** Validar no Chrome/Edge o funcionamento real das janelas no escritório e da aba Workflows para marcar aceite formal.
4. **[Feature] História 01.12:** Implementar host multi-janelas e docking no Window Manager.
5. **[Decisão & Descoberta] EP-12 & EP-09:** Definir destino do protótipo `dis-modular` e plugar botão de trigger do scan de sessões na Central de Sessões.
6. **[Programa Autônomo] EP-13:** Executar o épico de memória curada em worktree dedicada (`hl-memory-ep13`).
