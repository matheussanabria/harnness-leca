# Guia de instalação: Harness Leca

Replica a arquitetura de **Projetos** do Claude Chat (instruções, memória, contexto, chats e tarefas programadas) dentro do Claude Code. A cada mensagem, o Claude recebe automaticamente as instruções e memórias do projeto ativo. Há também uma interface web local para ver tudo.

## Pré-requisitos

| Item | Para quê | Como conferir |
|---|---|---|
| Windows 10/11 | O hook usa PowerShell | — |
| [Claude Code](https://claude.com/claude-code) (app desktop ou CLI) | Rodar o harness | abrir o app |
| [Git](https://git-scm.com/downloads) | Clonar o repositório | `git --version` |
| [Node.js 18+](https://nodejs.org) | Só para a interface web | `node -v` |

> O hook é um script PowerShell, então o harness funciona direto só no Windows. No Mac/Linux é preciso reescrever `.claude/hooks/load-project.ps1` (ex.: em bash) e ajustar `.claude/settings.json`.

## 1. Clonar o repositório

Você precisa de acesso ao repositório no GitHub. Se ele for privado, peça a quem o criou para convidar sua conta.

```bash
git clone https://github.com/matheussanabria/harnness-leca.git
cd harnness-leca
```

## 2. Abrir no Claude Code

Abra a pasta `harness-leca` como diretório de trabalho do Claude Code (no app desktop: *Select folder*; na CLI: rode `claude` dentro da pasta).

Na primeira vez, o Claude Code pode pedir para confiar na pasta e aprovar o hook de `.claude/settings.json`. **Aprove**: ele é o que carrega instruções e memórias a cada mensagem.

## 3. Conferir se funcionou

Envie qualquer mensagem. O Claude deve receber um bloco `<project-harness>` com o projeto ativo, as instruções e as memórias. Para ver o que o hook injeta, rode no terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

## Estrutura

```
harness-leca/
├── CLAUDE.md                    # regras para o Claude (memória, chats)
├── SETUP.md                     # este guia
├── .claude/
│   ├── settings.json            # registra o hook UserPromptSubmit
│   ├── launch.json              # atalho para subir a interface web
│   └── hooks/load-project.ps1   # injeta instruções + memória a cada mensagem
├── global/
│   ├── instructions.md          # instruções válidas para todos os projetos
│   └── memory.md                # memória válida para todos os projetos
├── projects/
│   ├── .active                  # slug do projeto ativo (uma linha)
│   ├── _template/               # copie para criar um projeto novo
│   └── <projeto>/
│       ├── instructions.md      # instruções do projeto
│       ├── memory.md            # memória do projeto
│       ├── context/             # arquivos de referência (planilhas, PDFs)
│       ├── chats/               # resumos de conversas (AAAA-MM-DD-titulo.md)
│       └── scheduled/           # tarefas recorrentes
└── ui/                          # interface web local (Node, sem dependências)
```

## Uso no dia a dia

**Criar um projeto novo**
```powershell
Copy-Item -Recurse projects/_template projects/meu-projeto
Set-Content projects/.active "meu-projeto"
```
Depois preencha `projects/meu-projeto/instructions.md`.

**Trocar de projeto:** edite `projects/.active` com o nome da pasta.

**Instruções:** escreva em `instructions.md` (do projeto ou em `global/`). Valem a partir da próxima mensagem, sem reiniciar.

**Memória:** o Claude acrescenta fatos duráveis em `memory.md` (`- [AAAA-MM-DD] fato`) quando aprende algo. Você também pode editar o arquivo à mão.

**Contexto:** coloque arquivos em `projects/<projeto>/context/`. O Claude recebe só a lista de nomes e abre o arquivo quando precisar.

**Chats:** peça "salve um resumo desta conversa" e o Claude grava em `chats/`.

## Interface web (opcional)

```bash
node ui/server.js
```

Abra http://localhost:4321. Ela mostra chats, instruções, memória, contexto e tarefas do projeto, com um seletor de projeto. É somente leitura e só escuta em `127.0.0.1`. No app desktop do Claude Code, o servidor `harness-ui` de `.claude/launch.json` também pode ser iniciado pelo painel de preview.

## Privacidade

O `.gitignore` deixa de fora o **conteúdo** de `projects/*/context/` e `projects/*/chats/`, para que dados de clientes não subam ao GitHub. Esses arquivos ficam só na sua máquina. As instruções e memórias (`instructions.md`, `memory.md`) **são versionadas**: não escreva nelas dados sensíveis (CPF, CNPJ, valores de clientes) se o repositório puder ser visto por terceiros.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Claude não menciona instruções/memória | Hook não aprovado ou desativado | Reabra a pasta e aprove o hook; teste o comando do passo 3 |
| Erro de execução do PowerShell | Política de scripts | O comando já usa `-ExecutionPolicy Bypass`; confira se `.claude/settings.json` está intacto |
| `Nenhum projeto ativo` no bloco injetado | `projects/.active` vazio ou com nome errado | Escreva o nome exato de uma pasta de `projects/` |
| `node` não reconhecido | Node.js não instalado | Instale em nodejs.org e reabra o terminal |
| `repository not found` ao clonar | Sem acesso ao repositório privado | Peça o convite e faça login no GitHub |
| Porta 4321 em uso | Outro processo na porta | `$env:PORT=4400; node ui/server.js` |
