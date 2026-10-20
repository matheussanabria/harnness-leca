---
name: multi-agent-coordination
description: >-
  Opera e audita o protocolo de coordenação concorrente multiagente (Gemini, Codex, Claude, OpenCode).
  Use quando o usuário disser "coordenar agentes", "claim de história", "handoff entre agentes",
  "posse de arquivos multiagente", "multi-agent sync", "ledger de coordenação", "passar tarefa para codex",
  "passar tarefa para gemini", ou quando múltiplos agentes estiverem trabalhando no mesmo repositório e for
  necessário isolar arquivos por trilha, registrar posse via CLI e auditar evidências de entrega.
  Não usar para planejar épicos arquiteturais (use epic-evolution-architect) nem para o ciclo comum de user story (use sdlc-pipeline).
language: pt-BR
version: "1.0.0"
date_created: "2026-10-20"
contract: manifest.yaml
---

# Multi-Agent Coordination — Protocolo de Governança e Ledger Concorrente

Capacidade especializada em orquestrar a atuação simultânea de múltiplos agentes autônomos ou desenvolvedores
em um mesmo repositório, garantindo divisão estrita de responsabilidades, propriedade exclusiva de arquivos,
rastreabilidade por ledger canônico e prevenção de conflitos de merge.

## Quando acionar / quando não acionar

- **Aciona:**
  - Registrar posse de tarefa ou história (`claim`, `start`, `heartbeat`).
  - Transferir formalmente trabalho entre motores de IA (`handoff`).
  - Notificar outros agentes sobre disponibilidade de contratos (`notify`).
  - Concluir história com registro formal de testes e evidências (`complete`).
  - Fiscalizar a matriz de propriedade exclusiva de arquivos (`ownership matrix`).
- **Não aciona:**
  - Diagnosticar arquitetura ou criar novos épicos → use `epic-evolution-architect`.
  - Conduzir o fluxo pontual de uma feature individual de usuário → use `sdlc-pipeline`.

## Entrada e saída

- **Entrada:** ID da história canônica (ex: `EP-09.01`), provedor (`gemini`, `codex`, `claude`, `opencode`), evidência de teste ou mensagem de handoff. Parâmetro `coordination_tool` (ex: `tools/coordination.js`).
- **Saída:**
  - Evento gravado no ledger canônico (`state.json`).
  - Projeções atualizadas automaticamente (`STATUS.md`, `context/coordination.md`, `inbox/*.md`).
  - Histórico de sincronização multiagente atualizado.

## Protocolo Operacional (6 Passos)

1. **Checagem de Caixa de Entrada:**
   - Antes de iniciar, consulte a caixa de entrada do provedor:
     ```powershell
     node tools/coordination.js inbox --provider <provedor>
     ```
2. **Posse e Início (Claim & Start):**
   - Nunca edite arquivos antes de registrar a posse formal:
     ```powershell
     node tools/coordination.js claim <ID_HISTORIA> --provider <provedor> --project <slug>
     node tools/coordination.js start <ID_HISTORIA> --provider <provedor> --project <slug>
     ```
   - Em execuções demoradas, emita `heartbeat` para sinalizar atividade contínua.
3. **Verificação da Matriz de Ownership:**
   - Cada trilha possui escopo restrito de arquivos (exemplo do `09-activity-interface-deploy-index.md`):
     - **Backend / Sync / Contratos:** Exclusivo de `Codex` (`tools/**`, `ui/server/**`).
     - **Frontend / UI / DOM / CSS:** Exclusivo de `Gemini` (`ui/public/**`).
     - **Integração Global:** Exclusivo do integrador em janela própria (`package.json`, índices, router).
   - O consumidor do contrato **não** edita o backend para facilitar a UI; solicita alteração por handoff.
4. **Governança Anti-Monólito & Congelamento:**
   - Arquivos acima do limite de 250–300 linhas ou listados como congelados devem ser decompostos antes de receberem novas regras. Proibido adicionar código no final do arquivo.
5. **Execução de Testes da Trilha:**
   - Rodar a suíte relevante antes de qualquer finalização (ex: `node --test tests/<suite>.test.js`).
6. **Finalização ou Handoff:**
   - **Para concluir:**
     ```powershell
     node tools/coordination.js complete <ID_HISTORIA> --provider <provedor> --evidence "<comando_e_resultado>" --project <slug>
     ```
   - **Para transferir:**
     ```powershell
     node tools/coordination.js handoff <ID_HISTORIA> --provider <provedor> --to <outro_provedor> --message "<contexto_e_contratos>" --project <slug>
     ```

## Referências

- Matriz de ownership e convenções: `references/ownership-e-fronteiras.md`
- Runbook de comandos CLI: `references/runbook-comandos.md`
