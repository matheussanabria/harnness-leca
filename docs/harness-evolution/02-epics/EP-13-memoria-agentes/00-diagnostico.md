---
tags: [harness-evolution, ep-13, diagnostico, memoria]
atualizado: 2026-10-22
---

# EP-13: Diagnóstico da memória atual

[Voltar ao épico](README.md)

Levantamento feito em 2026-10-22 no projeto `harness-leca`. Tamanhos medidos com `wc -c` no disco.

## 1. Quem escreve e quem lê

| Artefato | Escrito por | Lido por | Observação |
|---|---|---|---|
| `projects/<slug>/memory.md` e `global/memory.md` | Usuário, agentes e `tools/lib/memory-review.js` (promoção) | Hook `.claude/hooks/load-project.ps1` (inteiro, a cada mensagem); `AGENTS.md` manda o Codex ler | Memória curada atual, em bullets `- [data] fato`. |
| `context/extraido-*.md` | `tools/extract-artifacts.js` | Revisão na interface | Rotulado como "Sugestões para revisão". |
| `context/memorias-consolidadas.md` | `tools/lib/consolidate.js` | Revisão na interface | Também sugestão. Não existe no `harness-leca`. |
| `~/.claude/projects/<dir>/memory/` | `tools/export-context.js` **e** o próprio Claude Code | Claude Code (`MEMORY.md` no início da sessão) | Dois escritores na mesma pasta. |
| `~/.gemini/antigravity-ide/knowledge/ki-projeto-<slug>/` | `tools/export-context.js` | Antigravity | Knowledge Item por projeto. |
| `~/.gemini/GEMINI.md` | Gemini CLI (`save_memory`) | Gemini CLI | Vazio hoje (0 bytes). |
| `.claude/context/<slug>.md`, `.gemini/context/<slug>.md` | `tools/export-context.js` | Ninguém identificado | Cópia local; verificar se tem consumidor. |

## 2. Problemas, com evidência

### P1. O export apaga a memória que o Claude Code grava

`tools/export-context.js:167` chama `writeFile(.../MEMORY.md, ...)` incondicionalmente. Qualquer linha que o Claude Code acrescentou ao próprio `MEMORY.md` some na próxima execução, e os arquivos `<slug>.md` que ele criou ficam órfãos (fora do índice).

### P2. Sugestões não revisadas chegam aos motores como memória

`tools/export-context.js:170` copia `extraido-regras.md` para `regras-e-diretrizes.md`, e `:207-208` copia o mesmo texto para o Knowledge Item do Gemini. O próprio arquivo de origem diz que é sugestão (`tools/extract-artifacts.js:162`). Resultado medido:

- `regras-e-diretrizes.md`: 31 KB, 127 bullets, dos quais os 4 textos de "ações destrutivas" e "ícones" aparecem 5 vezes cada (uma por conversa de origem).
- O README do épico de memória do Claude aponta para `memorias-consolidadas.md`, que não existe nesta pasta.

### P3. Histórico bruto exportado como memória

`historico-conversas.md` (Claude) e `conversas-indice.md` (Gemini) têm 140 KB cada. Vêm de `extraido-conversas.md` (146 KB). É fonte bruta, não fato durável. No Gemini, o Knowledge Item do `harness-leca` soma 172 KB, dos quais 1,2 KB são a memória curada.

### P4. A mesma memória entra duas vezes no Claude

O hook injeta `memory.md` inteiro a cada mensagem e o `MEMORY.md` gerado por `generateClaudeMemory` repete as mesmas linhas no início da sessão. Nesta conversa, as quatro memórias do projeto aparecem duas vezes no prompt.

### P5. Granularidade de bullet

Um arquivo por projeto com bullets não permite carregar só o relevante, não guarda o porquê nem a origem, e não tem chave para deduplicar além do texto exato (`tools/lib/memory-review.js:120`). Os maiores: `saude-dispensacao` 3,6 KB e `57multimarcas` 3,6 KB, injetados inteiros a cada mensagem.

### P6. Nada evita duplicata nem segredo na escrita direta

Agentes escrevem em `memory.md` pela instrução do `CLAUDE.md`, sem ferramenta. O `redact` protege as conversas importadas, mas não a memória escrita à mão.

### P7. Pequenos desvios de regra

- `tools/export-context.js` usa emojis nos logs (pacote em "Processando projeto" e marca de verificação em "Concluído"), contra a regra global.
- O arquivo tem 263 linhas e cuida de três destinos; qualquer história nova o empurra além do teto de 300.

## 3. O que já existe e será reaproveitado

| Peça | Papel no EP-13 |
|---|---|
| `tools/lib/memory-review.js` + `ui/public/js/modules/review.js` | Já são a ponte oficina para vitrine. Só muda o destino (13.06). |
| `tools/lib/consolidate.js` | Já junta candidatos repetidos. Continua na oficina. |
| `redact` da importação | Base para a recusa de segredos no `save` (13.05). |
| `tests/golden/` | Garante que a mudança de formato não altera chats. |
| Hook com neutralização de tag | Base do envelope `<memoria_recuperada>` (13.07). |

## 4. Referências externas consideradas

| Sistema | Ideia aproveitada | Ideia descartada |
|---|---|---|
| Claude Code | Índice sempre carregado, detalhe sob demanda; um fato por arquivo; tipos `user`, `feedback`, `project`, `reference`; porquê e como aplicar | Índice escrito à mão (diverge dos arquivos) |
| Gemini CLI (`save_memory`) | Ferramenta dedicada para salvar | Arquivo único que cresce sem limite e entra inteiro |
| Antigravity (relatos de terceiros, não oficial) | Camadas: logs, extração automática, itens ligados com resumo | Extração que vai direto para a memória sem revisão |
