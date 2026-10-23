# Guia de instalação: Harness Leca

Replica a arquitetura de **Projetos** do Claude Chat (instruções, memória, contexto, chats e tarefas programadas) dentro do Claude Code. A cada mensagem, o Claude recebe automaticamente as instruções e memórias do projeto ativo. Há também uma interface web local para ver tudo e um importador para trazer conversas antigas do Claude Code.

> O repositório contém só o **processo** (hook, interface, importador, template). Seus projetos, memórias e conversas ficam apenas na sua máquina e nunca sobem ao GitHub.

## Pré-requisitos

| Item | Para quê | Como conferir |
|---|---|---|
| Windows 10/11 | O hook usa PowerShell | — |
| [Claude Code](https://claude.com/claude-code) (app desktop ou CLI) | Rodar o harness | abrir o app |
| [Git](https://git-scm.com/downloads) | Clonar o repositório | `git --version` |
| [Node.js 22.13+](https://nodejs.org) | Interface web, importadores e `sync` (o opencode usa o `node:sqlite` embutido) | `node -v` |

> O hook é um script PowerShell, então o harness funciona direto só no Windows. No Mac/Linux é preciso reescrever `.claude/hooks/load-project.ps1` (ex.: em bash) e ajustar `.claude/settings.json`. A interface e o importador (Node) funcionam em qualquer sistema.

## 1. Clonar o repositório

Se o repositório for privado, peça acesso a quem o criou.

```bash
git clone https://github.com/matheussanabria/harnness-leca.git
cd harnness-leca
```

## 2. Abrir no Claude Code

Abra a pasta `harness-leca` como diretório de trabalho (app desktop: *Select folder*; CLI: rode `claude` dentro da pasta). Na primeira vez, **aprove o hook** de `.claude/settings.json`: é ele que carrega instruções e memórias a cada mensagem.

## 3. Criar seus arquivos globais

Instruções e memória globais valem para todos os projetos e ficam só na sua máquina:

```powershell
Copy-Item global/instructions.example.md global/instructions.md
Copy-Item global/memory.example.md global/memory.md
```

Edite `global/instructions.md` com o que o Claude deve seguir sempre (idioma, tom, etc.).

## 4. Criar o primeiro projeto

```powershell
Copy-Item -Recurse projects/_template projects/meu-projeto
Set-Content projects/.active "meu-projeto"
```

Preencha `projects/meu-projeto/instructions.md`. Para conferir o que o hook injeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/load-project.ps1
```

Envie qualquer mensagem no Claude Code: ele deve receber o bloco `<project-harness>` com o projeto ativo.

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
│   ├── instructions.example.md  # copie para instructions.md (local)
│   └── memory.example.md        # copie para memory.md (local)
├── tools/
│   ├── import-claude-code-chats.js   # importa conversas do Claude Code
│   ├── import-gemini-chats.js        # importa conversas do Antigravity / Gemini
│   ├── import-opencode-chats.js      # importa conversas do opencode (SQLite local)
│   ├── extract-artifacts.js          # extrai regras, memórias e documentos das conversas
│   ├── extraction-state.js           # o que já foi analisado / mudou depois
│   ├── export-context.js             # exporta memória e regras para o contexto do Claude e Gemini
│   ├── export-claude-sessions.js     # reidrata o histórico de sessões do Claude Code (.jsonl)
│   ├── sync.js                       # atualiza os 3 motores de uma vez
│   └── lib/
│       ├── chat-format.js            # formato do .md de conversa (escrever e ler): único dono do formato
│       ├── chat-store.js             # grava/renomeia/data um chat (importadores)
│       ├── chat-save.js              # salva a conversa feita na interface
│       ├── engines/                  # motores do chat: claude.js, opencode.js, gemini.js + catalog.json (modelos) + index.js (registro)
│       ├── state.js                  # controle do que já foi analisado
│       ├── redact.js                 # redação de segredos e dados pessoais
│       └── root.js, env.js, cli.js, text.js, limits.js, projects.js, claude-bin.js, project-mcp.js
├── tests/                       # npm test (node --test, sem dependências); golden master dos importadores em tests/golden/
├── ui/                          # interface web local (Node, sem dependências)
└── projects/                     # LOCAL: só o _template é versionado
    ├── .active                  # slug do projeto ativo (uma linha)
    ├── _template/               # copie para criar um projeto novo
    └── <seu-projeto>/
        ├── instructions.md      # instruções do projeto
        ├── memory.md            # memória do projeto
        ├── context/             # arquivos de referência (planilhas, PDFs)
        ├── chats/               # conversas (AAAA-MM-DD-titulo.md)
        └── scheduled/           # tarefas recorrentes
```

## Uso no dia a dia

- **Trocar de projeto:** edite `projects/.active` com o nome da pasta.
- **Instruções:** escreva em `instructions.md` (do projeto ou em `global/`). Valem a partir da próxima mensagem, sem reiniciar.
- **Memória:** o Claude acrescenta fatos duráveis em `memory.md` (`- [AAAA-MM-DD] fato`). Você também pode editar à mão.
- **Contexto:** coloque arquivos em `projects/<projeto>/context/`. O Claude recebe só a lista de nomes e abre o arquivo quando precisar.
- **Chats:** peça "salve um resumo desta conversa" e o Claude grava em `chats/`.

## Motor local (Ollama)

O "Ollama Local" do chat não é um serviço na nuvem: é um daemon que roda na sua máquina, em `http://localhost:11434`. Sem ele no ar, a interface mostra "Ollama desligado" (e não um erro de internet).

```powershell
# 1. Instale o Ollama (Windows): https://ollama.com/download
# 2. Suba o daemon (o app do Windows já o mantém em segundo plano)
ollama serve
# 3. Baixe o modelo padrão (~1 GB de RAM em uso)
ollama pull qwen2.5-coder:1.5b
# 4. Confira
curl.exe http://localhost:11434/api/tags
```

Requisitos e ajustes:

- Pelo menos **3000 MB de RAM livre** para o motor local; o HIA só roteia tarefas leves para ele quando a máquina está apta.
- Modelos alternativos: `qwen2.5-coder:3b` e `deepseek-r1:1.5b`.
- Para usar um Ollama em outra máquina (LAN/VPN), defina `OLLAMA_URL=http://<host>:11434` em `global/.env` e reinicie a interface.
- Docker: `docker run -d -p 11434:11434 -v ollama:/root/.ollama ollama/ollama` e depois `docker exec -it <container> ollama pull qwen2.5-coder:1.5b`.


## Guias complementares

- Getting-started series in English: [01 overview](docs/setup/01-overview.md), [02 installation](docs/setup/02-installation.md), [03 engines and credentials](docs/setup/03-engines-and-credentials.md), [04 first sync](docs/setup/04-first-sync.md), [05 adopt existing projects](docs/setup/05-adopt-existing-projects.md). Agents: [docs/agents/BOOTSTRAP.md](docs/agents/BOOTSTRAP.md).
- [Importadores e extração de conversas](docs/setup/importadores.md): Claude Code, Antigravity/Gemini e extração de regras, memórias e documentos.
- [Rotinas, revisão de memória e sincronização](docs/setup/rotinas-e-sync.md): tarefas recorrentes, sugestões de memória, `sync` dos 3 motores e uso com outros agentes.
- [Exportar contexto, interface web e desenvolvimento](docs/setup/interface-e-desenvolvimento.md): exportação para os agentes, interface web, testes, privacidade e problemas comuns.
