---
name: epic-evolution-architect
description: >-
  Conduz o diagnóstico arquitetural e estrutura programas de evolução técnica em
  épicos e histórias atômicas (metodologia Harness Evolution). Use quando o usuário disser
  "evolução arquitetural por épicos", "estruturar programa de evolução", "decompor épico em histórias",
  "plano diretor de evolução", "criar auditoria de arquitetura", "modelar épicos do harness", ou
  quando precisar estruturar uma grande refatoração/evolução modular com ADRs, baseline de testes e índice mestre.
  Não usar para feature individual convencional (use sdlc-pipeline) nem para coordenação multiagente (use multi-agent-coordination).
language: pt-BR
version: "1.0.0"
date_created: "2026-10-20"
contract: manifest.yaml
---

# Epic Evolution Architect — Decomposição Modular por Épicos

Capacidade especializada em planejar e estruturar transformações arquiteturais complexas em programas
de evolução previsíveis, modulares e rastreáveis, baseados na metodologia testada em `docs/harness-evolution/`.

## Quando acionar / quando não acionar

- **Aciona:**
  - Estruturação de programas de evolução de grande porte (Fase 0 a Fase N).
  - Decomposição de macro-subsistemas em épicos e histórias com contrato `story-template`.
  - Elaboração de diagnósticos de estado atual (inventário, contratos, permissões, gaps).
  - Redação de Decisões de Arquitetura (ADRs) transversais.
- **Não aciona:**
  - Entrega de feature única isolada → use `sdlc-pipeline`.
  - Quebra simples de user story pontual em tarefas técnicas → use `technical-breakdown`.
  - Protocolo de posse de tarefas, ledger de sincronização e handoff multiagente → use `multi-agent-coordination`.

## Entrada e saída

- **Entrada:** Escopo do subsistema, `MAPA.md`, código atual, regras de limite modular (ex: máx. 300 linhas) e baseline existente. Parâmetro `docs_root` (ex: `docs/<nome-programa>/`).
- **Saída:**
  - Estrutura completa de documentação (`docs/<programa>/`):
    - `00-index.md`: Índice mestre, progresso e grafo de dependências Mermaid.
    - `01-architecture/`: Diagnóstico, mapa de dependências e arquitetura-alvo.
    - `02-epics/EP-xx/`: README do épico e histórias individuais (`xx.yy-slug.md`).
    - `03-decisions/`: ADRs formais.
    - `04-test-plans/`: Planos de teste de regressão e baseline.
    - `05-progress/`: Tracking oficial de conclusão baseado em evidências.

## Fluxo de Trabalho (5 Passos)

1. **Auditoria & Diagnóstico Inicial (Fase 0):**
   - Inventariar módulos, componentes, rotas e dependências existentes.
   - Detectar duplicações, lacunas de dados e acoplamentos indevidos.
   - Estabelecer o baseline de testes automatizados e regressão visual.
2. **Arquitetura-Alvo e ADRs:**
   - Desenhar o modelo-alvo modular com fronteiras claras.
   - Documentar decisões de alto impacto como ADRs em `03-decisions/` (`ADR-xxx-titulo.md`).
3. **Índice Mestre e Grafo de Dependências:**
   - Criar `00-index.md` mapeando todos os épicos com ID canônico (`EP-00` a `EP-nn`).
   - Mapear a ordem de execução via diagrama Mermaid (`EP-00 -> EP-01 -> ...`).
4. **Decomposição em Histórias Atômicas:**
   - Cada entrega planejada vira um arquivo individual `02-epics/EP-xx/xx.yy-slug.md`.
   - Seguir rigorosamente o padrão de contrato:
     - Frontmatter YAML com `id`, `epico`, `prioridade`, `status: planejada`, `dependencias`.
     - 1. Identificação | 2. Contexto | 3. Objetivo | 4. Requisitos (RF/RNF) | 5. Arquitetura | 6. Implementação passo a passo | 7. Testes pré-definidos | 8. Critérios de aceite | 9. Riscos | 10. Evidências.
5. **Critérios Não Funcionais Obrigatórios:**
   - Limite por arquivo: 250 a 300 linhas estrito (proibido "god files").
   - Responsabilidade Única (SRP): separação de visual/DOM, rede/HTTP e regras de negócio.
   - Design System & Ícones: ícones estritamente FontAwesome (`fa-solid` / `fa-regular`), nenhum emoji.

## Referências

- Guia e convenção de pastas: `references/estrutura-pastas.md`
- Contrato da história: `references/contrato-historia.md`
