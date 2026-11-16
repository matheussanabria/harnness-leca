# 03. Mecanismos, sessões e credenciais

Parte da [série de configuração](01-overview.pt-BR.md). Instale apenas os mecanismos que você usa; o Harness ignora os que não encontrar.

Leia em inglês: [03 Engines, sessions and credentials](03-engines-and-credentials.md).

## A regra sobre credenciais

**Os logins de assinatura são gerenciados pelas próprias CLIs.** Cada CLI mantém seu login no perfil do usuário. Integrações configuradas com chaves de API podem ler valores do ambiente ou de `global/.env` (ignorado pelo Git), incluindo `GEMINI_API_KEY` e `ANTHROPIC_API_KEY`.

Consequências:
- Faça login uma vez por mecanismo, em um terminal, usando o comando próprio dele.
- Nunca cole os arquivos de credenciais abaixo em um chat, chamado ou prompt de agente. Agentes não devem abri-los.
- Se um mecanismo disser que não há sessão iniciada, a interface do Harness mostra o comando a executar (ele vem de `tools/lib/engines/errors.js`).

## Resumo dos mecanismos

| Mecanismo | Instalar | Fazer login | Iniciar sessão | Local do login armazenado pela CLI | Conversas lidas de |
|---|---|---|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | execute `claude` e depois `/login` (plano Pro/Max) ou defina `ANTHROPIC_API_KEY` em `global/.env` | `claude` dentro da pasta do projeto; `claude --resume` para continuar | `~/.claude/.credentials.json` | `~/.claude/projects/<folder>/*.jsonl` |
| Codex | `npm install -g @openai/codex` (não verificado na máquina do autor) | entre com o ChatGPT na CLI do Codex (`codex login`, não verificado) | `codex` dentro da pasta do projeto | `~/.codex/auth.json` | `~/.codex/sessions/**/*.jsonl` |
| opencode | `npm install -g opencode-ai` | `opencode auth login` | `opencode` dentro da pasta; `npm run opencode` inicia o servidor na porta 63186 para a interface | `~/.local/share/opencode/auth.json` | `~/.local/share/opencode/opencode.db` (SQLite) |
| Gemini / Antigravity | Instale o IDE Antigravity e entre com sua conta Google (não é necessária uma CLI) | No IDE; opcionalmente, uma chave de API gratuita do Google AI Studio para o chat da interface | Abra a pasta no Antigravity | Gerenciado pelo IDE | `~/.gemini/antigravity-ide/brain` |
| Ollama (local, opcional) | [ollama.com/download](https://ollama.com/download) | nenhum | `ollama serve` | nenhum | não importado (somente respostas) |

`~` é o seu perfil de usuário, por exemplo, `C:\Users\<you>`. Os locais dos arquivos acima foram confirmados pela verificação de que os arquivos existem na máquina do autor; o conteúdo deles não foi lido.

## Claude Code

```powershell
npm install -g @anthropic-ai/claude-code
cd path\to\harness-leca
claude          # depois digite /login e siga o fluxo no navegador
```

Se o Harness não encontrar o executável, defina `CLAUDE_BIN` em `global/.env` com o caminho absoluto de `claude.exe` (instalações do npm ficam em `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\`).

## Codex

As sessões do Codex são importadas por um script próprio e **não** fazem parte de `npm run sync`:

```powershell
node tools/import-codex-chats.js --from my-project --project my-project --dry-run
node tools/import-codex-chats.js --from my-project --project my-project
```

Se `codex` não estiver em `PATH`, defina `CODEX_BIN` em `global/.env`.

## opencode

```powershell
npm install -g opencode-ai
opencode auth login          # escolha um provedor e conclua o login
opencode                     # sessão TUI na pasta atual
npm run opencode             # servidor sem interface na porta 63186, usado pelo chat web
```

O opencode oferece modelos gratuitos (nomes terminados em `-free`). As rotinas e a extração do Harness aceitam somente esses modelos, para que execuções agendadas não consumam cota paga. Defina `OPENCODE_BIN` ou `OPENCODE_URL` em `global/.env` se a detecção falhar.

## Gemini / Antigravity

Abra a pasta do projeto no IDE Antigravity. As conversas ficam em `~/.gemini/antigravity-ide/brain` e são coletadas por `npm run sync`. Para obter respostas imediatas do Gemini na interface web do Harness, adicione uma chave gratuita do [Google AI Studio](https://aistudio.google.com/) a `global/.env`:

```
GEMINI_API_KEY=your_key_here
```

Sem ela, a interface grava sua mensagem em `bridge/gemini-inbox.jsonl` e o agente do IDE a coleta.

## Ollama (modelo local opcional)

```powershell
ollama serve
ollama pull qwen2.5-coder:1.5b
curl.exe http://localhost:11434/api/tags
```

Requer cerca de 3000 MB de RAM livre. Detalhes e alternativa com Docker: [SETUP.md](../../SETUP.md#motor-local-ollama).

## Qual mecanismo devo usar?

Todos funcionam em conjunto; o Harness não fixa um projeto a um único mecanismo. Uma divisão prática: Claude Code ou Codex para tarefas pesadas de programação, modelos gratuitos do opencode para extrações e rotinas, Gemini/Antigravity para trabalho no IDE e Ollama para pequenas tarefas locais.

Próximo: [04 Primeira importação, sincronização e exportação](04-first-sync.pt-BR.md).
