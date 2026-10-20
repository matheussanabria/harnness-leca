# Exportar contexto, interface web e desenvolvimento

Parte do [guia de instalação](../../SETUP.md) do Harness Leca.

## Exportar contexto e reidratar histórico nos agentes (Claude Code & Gemini)

Se você precisou restaurar o PC, trocou de máquina ou quer injetar as memórias e conversas do Harness Leca diretamente nos agentes instalados:

### 1. Sincronizar Memória e Regras nos Agentes (`npm run export:context`)

Exporta todas as memórias consolidadas, regras de negócio e índices de conversas preservados no Harness Leca diretamente para as pastas de contexto nativo:

```bash
npm run export:context                      # exporta todos os projetos
node tools/export-context.js --project dai  # exporta só um projeto específico
node tools/export-context.js --dry-run      # simula sem gravar
```

- **Claude Code:** Grava em `~/.claude/projects/<pasta>/memory/` (`MEMORY.md`, `regras-e-diretrizes.md`, `memorias-consolidadas.md` e `historico-conversas.md`). O Claude Code carrega esses arquivos automaticamente na abertura de qualquer nova sessão.
- **Gemini / Antigravity:** Cria Knowledge Items em `~/.gemini/antigravity-ide/knowledge/ki-projeto-<slug>/` e atualiza a regra global em `~/.gemini/config/rules/harness-projects-overview.md`.
- **Local:** Cria resumos rápidos em `.claude/context/<slug>.md` e `.gemini/context/<slug>.md` dentro do próprio harness.

### 2. Reidratar Histórico de Chats no Claude Code (`npm run export:claude-sessions`)

Converte os arquivos Markdown (`projects/<slug>/chats/*.md`) em sessões `.jsonl` compatíveis com o histórico do Claude Code, permitindo listar e continuar conversas via terminal:

```bash
npm run export:claude-sessions                      # converte todos os projetos
node tools/export-claude-sessions.js --project dai  # converte um projeto específico
node tools/export-claude-sessions.js --dry-run      # simula sem gravar
node tools/export-claude-sessions.js --force        # regrava mesmo se já existir
```

- Salva as sessões nas pastas de trabalho originais de cada projeto em `~/.claude/projects/` e espelha na pasta do harness.
- Para abrir o seletor interativo e continuar qualquer conversa:
  ```bash
  claude --resume
  ```

## Interface web

```bash
node ui/server.js
```

Abra http://localhost:4321. Mostra chats, instruções, memória, contexto e tarefas, com seletor de projeto. Só escuta em `127.0.0.1`. A navegação é somente leitura; a única escrita é o botão **Conversar com o Projeto**, que conversa com Claude Code, opencode ou Gemini e salva a conversa em `chats/` quando você pede. No app desktop do Claude Code, o servidor `harness-ui` de `.claude/launch.json` também pode ser iniciado pelo painel de preview.

### Ferramentas, Acesso e Permissões do Chat

No chat da interface, os motores (Claude Code, OpenCode e Gemini) contam com **accesso total ao computador** para navegar, inspecionar qualquer diretório, editar arquivos e rodar comandos necessários para o projeto, sem ficar confinados exclusivamente à pasta do repositório.

**Regra mandatória para ações destrutivas:**
- Operações potencialmente destrutivas — especialmente **remover ou apagar arquivos ou diretórios** (`rm`, `del`, `rmdir`, `Remove-Item`, `git clean`, etc.) ou destruir dados de forma irreversível — **NUNCA são executadas diretamente sem autorização prévia**.
- O modelo é instruído e obrigado a parar, listar os arquivos ou diretórios afetados, explicar o motivo e solicitar a permissão explícita do usuário no chat antes de realizar qualquer exclusão.

Configure cada projeto em `projects/<projeto>/mcp.json` (fica só na sua máquina):

```json
{
  "repo": "C:/Users/voce/git/57multimarcas",
  "servidores": ["cod-design-system"],
  "restrito": false
}
```

- `repo`: pasta inicial de trabalho do motor (lê o código, edita e roda comandos). Ele também lê `projects/<projeto>/` (chats e contexto). Sem `repo`, trabalha a partir de `projects/<projeto>/`.
- `servidores`: quais servidores do `.mcp.json` do repositório carregar (caminhos relativos viram absolutos). Só esses são liberados (`mcp__<nome>`).
- `mcpServers` (opcional): servidores próprios do projeto, no formato do `.mcp.json`, com caminhos absolutos.
- `"restrito": true` ou `"modo": "restrito"` (opcional): se ativado, reativa o confinamento estrito (`--restricted`), impedindo o Claude de acessar pastas fora do `repo` e de `projects/<projeto>/`.
- `"modo": "leitura"` (opcional): só `Read`/`Glob`/`Grep`, sem editar nem rodar comandos. Recomendado para ambientes onde não se deseja nenhuma alteração.

Ao abrir um chat:
- **Você**: bolha colorida à direita.
- **Claude**: bolha cinza à esquerda, com markdown renderizado.
- **Processamento interno**: accordion recolhido ("⚙ Processamento interno · N etapas"); cada etapa abre com entrada e resultado.
- Mensagens longas são limitadas a ~240 px, com "Ver mais / Ver menos".

## Desenvolvimento: testes, checagens e pre-commit

Nada disto acrescenta dependência ao projeto.

| Comando | O que faz |
|---|---|
| `npm test` | Roda a suíte (`node --test`): importadores (golden master em `tests/golden/`), rotas do servidor, motores, estado de extração, redação de segredos. Usa raiz e pasta de usuário temporárias: nunca toca em `projects/` nem em `global/`. |
| `npm run check` | Sintaxe de todos os `.js` (com o Node que estiver instalado) e validade dos `.json`. |
| `npm run types` | Checagem de tipos por JSDoc nos arquivos com `// @ts-check` (contratos em `tools/lib/types.d.ts`). Instala o TypeScript numa pasta temporária na primeira vez (precisa de rede). |
| `npm run setup:hooks` | Ativa o pre-commit (`git config core.hooksPath .githooks`; para desativar, `git config --unset core.hooksPath`). |

**Pre-commit** (depois de `npm run setup:hooks`): barra o commit se entrar dado local (`projects/` exceto `_template`, `global/*.md` pessoais, `.env`, `bridge/*.jsonl`, mesmo com `git add -f`), se uma linha adicionada tiver segredo de formato conhecido (chave de API, JWT, webhook, chave privada…; o valor nunca é impresso) ou se `check` ou os testes falharem. Para exemplos e fixtures de teste, ponha `allow-secret` num comentário da mesma linha. Em commits só de documentação, `HARNESS_SKIP_TESTS=1 git commit ...` pula os testes.

**CI** (`.github/workflows/ci.yml`): `check` e `test` em Ubuntu e Windows, com Node 22.13.0 (o mínimo) e 24.x, mais um job de tipos.

**Mudou o formato de um chat importado de propósito?** Rode `UPDATE_GOLDEN=1 npm test` e revise o diff de `tests/golden/` antes de commitar.

## Privacidade: o que sobe ao GitHub

O `.gitignore` versiona **apenas o processo**. Ficam de fora: tudo em `projects/` (exceto `_template`), `global/instructions.md` e `global/memory.md`. Se for contribuir com melhorias, rode `git status` antes de cada commit e confira que nenhum dado pessoal ou de cliente está na lista.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Claude não menciona instruções/memória | Hook não aprovado ou desativado | Reabra a pasta e aprove o hook; teste o comando do passo 4 |
| Erro de execução do PowerShell | Política de scripts | O comando já usa `-ExecutionPolicy Bypass`; confira se `.claude/settings.json` está intacto |
| `Nenhum projeto ativo` no bloco injetado | `projects/.active` ausente ou com nome errado | Escreva o nome exato de uma pasta de `projects/` |
| Interface mostra "Nenhum projeto ainda" | Ainda não criou projeto | Passo 4 ou importe conversas |
| `node` não reconhecido | Node.js não instalado | Instale em nodejs.org e reabra o terminal |
| `repository not found` ao clonar | Sem acesso ao repositório privado | Peça o convite e faça login no GitHub |
| Importador: "Nenhuma pasta contém ..." | Nome de origem errado | Use `--list` e copie o trecho do nome |
| Porta 4321 em uso | Outro processo na porta | `$env:PORT=4400; node ui/server.js` |
