---
id: ADR-010
titulo: Runtime de Agente com Loop Multi-turnos e Scratchpad no Ateliê de Protótipos
status: proposta
data: 2026-10-26
historias: [15.01, 15.02, 15.03, 15.04]
tags: [harness-evolution, adr, atelie, prototipos, agent-loop, tools]
---

# ADR-010: Runtime de Agente com Loop Multi-turnos e Scratchpad no Ateliê de Protótipos

## Contexto

O Ateliê de Protótipos (`ui/public/js/modules/prototype-atelier.js` e `prototype-chat-bridge.js`) opera atualmente sob um modelo **One-Shot de Turno Único**:
1. O usuário digita uma instrução no chat do Ateliê.
2. O sistema injeta o prompt com instruções de formatação rígida:
   `"Responda com blocos neste formato exato: <arquivo caminho="...">...</arquivo>. Reescreva o arquivo inteiro quando alterá-lo."`
3. O modelo (Gemini, OpenCode, Claude) tenta cuspir todo o HTML e CSS completo do protótipo em uma única resposta de texto contínuo.

### Problemas Observados
- **Estouro de `maxOutputTokens` (8.192 tokens no Gemini e limites similares em outros modelos):** Protótipos realistas e completos com múltiplos cards, componentes do Design System, SVGs e formulários excedem a janela de saída em um único turno, truncando o HTML no meio e quebrando o preview.
- **Instabilidade e Erros de Cota:** Erros como HTTP 503 (`UNAVAILABLE`), HTTP 429 e `network error` ocorrem frequentemente quando o modelo tenta gerar monólitos em streaming demorado.
- **Falta de Interação e Planejamento:** O modelo não pode validar hipóteses com o usuário antes de gerar, nem planejar uma arquitetura em etapas antes de queimar tokens de código.
- **Contraste com a IDE Antigravity:** Na IDE, o modelo nunca quebra por limite de arquivo porque opera em **Agent Loop autônomo**, usando ferramentas cirúrgicas (`write_to_file`, `replace_file_content`) e planejamento em scratchpad.

## Decisão Proposta

Transformar a geração e edição do Ateliê em um **Atelier Agent Loop** nativo no Harness:

1. **Protocolo com Ferramentas do Ateliê (Tool-Calling):**
   Substituir a exigência de "cuspir arquivo inteiro em texto" por ferramentas semânticas e atômicas:
   - `atelier_plan(steps, assumptions)`: Registra o plano de construção na sessão.
   - `atelier_write_screen(screenId, htmlFragment)`: Escreve ou substitui uma tela específica de forma modular.
   - `atelier_patch_styles(cssContent)`: Adiciona ou atualiza regras no `styles/proto.css`.
   - `atelier_ask_user(question, options)`: Solicita esclarecimento antes de prosseguir quando houver ambiguidade no briefing.
   - `atelier_complete(summary)`: Finaliza a iteração e atualiza o canvas de forma atômica.

2. **Workspace de Rascunho Isolado (`scratch/`):**
   Cada protótipo mantém uma área de trabalho temporária em `projects/<slug>/design/prototypes/<protoId>/scratch/` para persistir planos intermediários, auditorias de acessibilidade e fragmentos antes de consolidar a versão (`v1`, `v2`, etc.).

3. **Arquitetura Anti-Monólito (< 300 linhas):**
   - O controlador do loop residirá em `ui/server/services/atelier-agent-runtime.service.js`.
   - Adaptadores para os motores de IA (`gemini-tools.adapter.js`, `opencode-tools.adapter.js`).
   - O cliente no Ateliê (`prototype-atelier-chat.js`) renderiza o progresso do plano e os cartões de interação em tempo real.

## Alternativas Consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Aumentar apenas `maxOutputTokens` (ex: 32k/64k) | Pouco código para alterar | Apenas adia o problema; continua monólito frágil; não resolve lentidão de streaming nem permite planejamento ou interação |
| Exigir que o usuário divida os prompts manualmente | Nenhuma alteração no código | Péssima experiência de uso; atrito cognitivo alto; quebra fluxos complexos |
| **Agent Loop com Ferramentas e Scratchpad (Recomendado)** | **Resolve definitivamente o limite de saída; modular; idêntico à experiência fluida da IDE; suporta todos os motores** | **Exige implementar o despachante de ferramentas no backend e atualizar a ponte do chat** |

## Consequências

Positivas:
- **Fim do truncamento de código:** Respostas parciais ou truncadas não quebram mais o arquivo final.
- **Economia massiva de tokens:** Ferramentas operam por deltas e arquivos isolados em vez de reenviar e reescrever o protótipo inteiro a cada ajuste.
- **Interatividade:** O modelo pode propor direções e tirar dúvidas no chat antes de gerar as telas.
- **Canvas estável:** O preview só é recarregado após a validação do bloco pelo `sanitizer`.

Trade-offs:
- Motores sem suporte nativo a function calling precisarão de parser estrito de envelope JSON/XML.
- O histórico de chamadas de ferramentas precisará ser salvo na sessão do chat em formato legível.

## Revisão
Revisar se novos motores oferecerem suporte a patching de DOM direto no browser.
