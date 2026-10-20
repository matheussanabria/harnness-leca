# Domínio 03: Destilação e Extração de Conhecimento
## Harness Leca — Especificação de Requisitos de Software

---

## 1. Visão do Domínio
O **Domínio de Destilação e Extração de Conhecimento** transforma o histórico volumoso de conversas brutas em conhecimento acionável e conciso. Ele atua como um pipeline cognitivo que identifica decisões arquiteturais, regras de negócio emergentes, glossário e correções de bugs, consolidando-os em artefatos reutilizáveis.

---

## 2. Requisitos Funcionais (RF)

- **RF-03.1 (Rastreamento de Estado de Extração):** O sistema deve manter em `projects/<slug>/context/extraido-conversas.md` (ou via `tools/extraction-state.js`) o status analítico de cada conversa (ex: `PENDENTE`, `PROCESSADA`, `CONTINUADA`).
- **RF-03.2 (Extração Assistida por LLM / Skill):** O sistema deve fornecer uma skill padronizada (`.agents/skills/extrair-artefatos/SKILL.md`) e script CLI (`tools/extract-artifacts.js`) capaz de processar conversas elegíveis.
- **RF-03.3 (Destilação de Artefatos Especializados):** A extração deve segregar os achados em seções claras:
  - **Memórias:** Fatos duráveis sobre o projeto com data de ocorrência.
  - **Regras:** Diretrizes de código, padrões arquiteturais e convenções.
  - **Decisões:** Justificativas técnicas e tradeoffs adotados.
  - **Glossário de Domínio:** Nomenclaturas e termos de negócio específicos.
- **RF-03.4 (Área de Staging para Revisão Humana):** O sistema deve gravar os artefatos extraídos inicialmente em `projects/<slug>/context/extraido-memorias.md` para que o desenvolvedor humano possa aprovar antes de integrar ao `memory.md` oficial.
- **RF-03.5 (Interface de Aprovação de Memória):** A interface web deve permitir visualizar as memórias sugeridas e promovê-las para `memory.md` com um clique.

---

## 3. Regras de Negócio (RN)

- **RN-03.1 (Análise Delta Estrita):** O extrator deve analisar apenas conversas com status `PENDENTE` ou que tenham sido continuadas após a última extração, evitando gasto desnecessário de tokens.
- **RN-03.2 (Não Sobrescrita de Memórias Oficiais):** O motor de extração nunca deve gravar diretamente no arquivo principal `memory.md` sem revisão ou comando explícito; a promoção deve passar pela camada de staging.
- **RN-03.3 (Deduplicação Semântica):** Ao sugerir uma nova memória, o motor de extração deve comparar semanticamente com as entradas existentes em `memory.md` para evitar redundâncias.
- **RN-03.4 (Concisão Extrema):** Cada item extraído deve ter no máximo 2 a 3 linhas, focando no "porquê" e na "regra resultante", omitindo ruídos conversacionais triviais.

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-03.1 (Otimização de Context Window):** Conversas longas devem ser segmentadas ou resumidas em chunks para não estourar a janela de contexto do modelo extrator.
- **RNF-03.2 (Determinismo de Formato):** A saída da extração deve seguir markdown estritamente compatível com o parser do Harness.

---

## 5. Casos de Uso Principais

### UC-04: Extração Semanal de Conhecimento
1. O desenvolvedor ou agente ativa a skill `extrair-artefatos` para o projeto ativo.
2. O sistema verifica `extraction-state` e filtra as 5 conversas ocorridas na semana.
3. A LLM processa o conteúdo e gera 4 decisões de arquitetura e 2 termos de glossário em `extraido-memorias.md`.
4. O desenvolvedor abre a UI web, revisa os itens propostos, edita um detalhe e clica em "Promover para Memória Oficial".
5. O sistema anexa as entradas com o timestamp do dia em `projects/<slug>/memory.md`.
