# 04. Primeira importação, sincronização e exportação

Parte da [série de configuração](01-overview.pt-BR.md). Pré-requisito: concluir a [instalação](02-installation.pt-BR.md) e ter pelo menos um projeto em `projects/` (crie ou [adote](05-adopt-existing-projects.pt-BR.md) um primeiro, pois `sync` nunca cria projetos).

Leia em inglês: [04 First import, sync and export](04-first-sync.md).

## Como as conversas encontram seu projeto

Uma conversa importada pertence a um projeto quando o **slug** do projeto (ou um **alias** de `projects/.sources.json`) aparece como segmento completo no caminho da pasta de trabalho da conversa. Por exemplo, uma sessão iniciada em `C:\Users\you\git\57multimarcas` vai para o projeto `57multimarcas`. Para nomes de pasta diferentes, adicione um alias:

```json
{ "health-records": ["prontuario"] }
```

`node tools/adopt-project.js` cria esse alias para você.

## Etapa 1: ver o que existe (somente leitura)

```powershell
node tools/import-claude-code-chats.js --list     # pastas do Claude Code e contagem de conversas
node tools/import-opencode-chats.js --list        # sessões do opencode agrupadas por pasta
node tools/import-gemini-chats.js --list          # conversas do Antigravity / Gemini
```

O Codex não tem `--list`: use `--dry-run` na etapa 2.

## Etapa 2: simular

```powershell
npm run sync:dry                                   # todos os mecanismos e projetos, sem gravar
node tools/sync.js --project my-project --dry-run  # um projeto
```

Opções de `sync`: `--project <slug>`, `--engine claude,gemini,opencode` (subconjunto), `--dry-run`, `--no-extract` (ignora a etapa local de extração).

## Etapa 3: executar a primeira importação

```powershell
npm run sync                                       # Claude Code + Gemini/Antigravity + opencode
node tools/import-codex-chats.js --from my-project --project my-project   # Codex, script separado
```

É seguro executar novamente: os arquivos são atualizados no mesmo lugar, nunca duplicados. Cada conversa vira `projects/<slug>/chats/YYYY-MM-DD-title.md`. Chamadas de ferramentas aparecem como blocos recolhidos `:::tool`, limitados a 1.500 caracteres.

Para importar uma pasta cujo nome não corresponde a nenhum projeto, indique-a explicitamente:

```powershell
node tools/import-claude-code-chats.js --from folder-fragment --project my-project --dry-run
node tools/import-opencode-chats.js --from folder-fragment --project my-project
```

Opção útil: `--no-tools` omite chamadas de ferramentas e deixa os arquivos bem menores.

## Etapa 4: conferir o resultado

```powershell
node tools/extraction-state.js --project my-project status
```

O comando lista conversas novas, analisadas ou alteradas desde a análise. Abra a interface com `npm run ui` e confira títulos, datas e mecanismos na lista de conversas do projeto.

## Etapa 5: transformar conversas em memória (opcional)

A extração propõe memórias, regras, decisões e termos em `projects/<slug>/context/`. **Nada entra em `memory.md` até você aprovar** no cartão "Memory" da interface (promover, editar ou descartar). Execute a extração somente com um modelo gratuito ou local, a menos que decida o contrário: consulte [rotinas-e-sync.md](rotinas-e-sync.md) (em português) para as configurações das rotinas.

## Etapa 6: exportar a memória revisada de volta aos mecanismos

```powershell
node tools/export-context.js --dry-run             # prévia
npm run export:context                             # gravar
node tools/export-context.js --report              # bytes e tokens aproximados por projeto e destino
```

Destinos: o bloco de memória do projeto Claude Code (`~/.claude/projects/<folder>/memory/MEMORY.md`, somente a seção gerenciada), o item de conhecimento do Gemini / Antigravity com a regra global, e as pastas locais `.claude/context/` e `.gemini/context/`.

Para continuar conversas antigas no Claude Code:

```powershell
npm run export:claude-sessions                     # adicione --project <slug> ou --dry-run; --force sobrescreve
claude --resume
```

## Resultado esperado

- `projects/<slug>/chats/` contém conversas e a interface as lista.
- `extraction-state ... status` mostra a quantidade pendente.
- Depois da exportação, uma nova sessão do Claude Code na pasta do projeto já menciona a memória revisada.

## Solução de problemas

| Sintoma | Causa provável e solução |
|---|---|
| `sync` não importa nada para um projeto | O nome da pasta e o slug são diferentes: adicione um alias ou use o importador com `--from` e `--project` |
| `Project "x" does not exist in projects/` | `sync` não cria projetos: crie ou adote o projeto antes |
| A importação do opencode falha com erro `node:sqlite` | O Node é anterior à versão 22.13: atualize o Node |
| Executável do Claude não encontrado | Defina `CLAUDE_BIN` em `global/.env` |
| As conversas contêm algo sensível | A ocultação é heurística: edite ou exclua o arquivo e confira novamente antes de compartilhar |
