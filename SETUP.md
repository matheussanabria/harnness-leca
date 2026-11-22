# Guia de instalação: Harness

[Read this guide in English](SETUP.en.md).

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
├── ui/                          # interface web local: server/ (Node, no runtime dependencies), public/ (legacy ES modules)
│   └── web/                     # React islands (TypeScript, Vite, Biome; ADR-011), built into ui/public/dist
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

## React islands (ADR-011)

New UI screens are React islands in `ui/web/`, mounted inside the legacy interface. The legacy UI works without a build;
an island route only shows a notice until the islands are built.

```bash
npm install            # React, Vite, TypeScript and Biome (pinned versions)
npm run build:web      # builds ui/web into ui/public/dist (gitignored)
```

Development loop: run `npm run dev:web` (rebuilds on save) in one terminal and `npm run ui:dev` in another, then reload the
browser. Use `npm run ui:dev` only inside a development worktree. In the main checkout (where you chat through the UI) run
`npm run ui` for daily use, because auto restart drops live chat answers; the server prints a warning if you start `ui:dev` there. Before committing island code: `npm run types:web`, `npm run lint:web` and `npm run e2e:web` (headless Edge).

## Engine host (EP-23.03)

The engine CLIs (claude, codex, opencode, gemini) run in a separate long-lived process, `ui/engine-host.js`, so restarting
the web server (`ui:dev` auto restart, a crash, a manual restart) no longer cuts an answer in progress: the browser
reattaches and gets the rest.

- `npm run ui` and `npm run ui:dev` start the host detached when it is not running (log in `logs/engine-host.log`).
- `npm run host` starts it in the foreground; `npm run host:stop` stops it (cutting answers in progress); `npm run host:restart` waits for them to finish, asks before forcing past 10 minutes, and starts a fresh host. The host never runs under `--watch`:
  after changing `tools/lib/engines`, `tools/lib/permissions.js` or `ui/server/services/engine-host/`, run
  `npm run host:stop` so the next chat starts a fresh host with the new code.
- It listens on `127.0.0.1` only, with a token created on the first start in `data/engine-host.token` (git-ignored).
  **One host per checkout (EP-23.07):** the main checkout uses port `4322`; any other checkout (a git worktree) uses
  a port of its own in `4400-4499`, derived from its folder, so a test server started from a worktree no longer takes
  the port of the main checkout's host (hosts of different checkouts have different tokens). `HARNESS_ENGINE_HOST_PORT`
  overrides it (`0` picks a free port); setting it to `4322` brings back the single fixed port (rollback).
- If a host of another checkout holds your port, the chat and `host:stop` / `host:restart` say whose it is, for example
  `Já existe um host de motores da pasta "harness-leca" (pid 1234) nesta porta`. Stop it from that folder
  (`npm run host:stop`) or end the process with that pid. `GET /identity` on the host (no token) returns only the
  folder name, pid and start time.
- `HARNESS_ENGINE_HOST=0` brings back the old in-process mode (rollback); `HARNESS_ENGINE_HOST_AUTOSTART=0` turns off
  the automatic start (the chat then answers 503 until `npm run host`).

## Hosts: local and VPS (EP-23.06)

The header's **Host** button shows the host in use and the other Harness installs you saved (name, URL, access PIN), each with its state read from its `/api/host/info`: online, offline, wrong PIN or incompatible version. **Abrir** loads that host's own interface in the tab; every host keeps its own `data/harness.sqlite` and nothing is copied between hosts. The list lives in `data/hosts.json` (git-ignored, mode 0600); the PIN never goes back to the browser (only its last 2 characters, 4 for longer tokens). Set `HARNESS_HOST_NAME` to name a host (default: the machine name).

A remote host is accepted only over HTTPS, or over HTTP on loopback, a private network (10.x, 172.16-31.x, 192.168.x) or Tailscale (100.64.0.0/10, `*.ts.net`). On the VPS, publish the Harness only behind Traefik with HTTPS and the access PIN (`npm run remote`), or only on the Tailscale network; never on a public address without authentication.

## Motion export (EP-24.05)

The Atelier exports a screen's animation (`screens/<id>.motion.json`) as WebM, MP4 or GIF with no extra install.

- It uses the installed Chrome (or Edge) in headless mode through `playwright-core`, the same launcher as the Atelier
  pilot tools; set `HARNESS_CHROME_PATH` when Chrome is not in the default folder.
- Encoding runs in that browser with WebCodecs plus `mediabunny` (MP4, WebM) and `gifenc` (GIF), pinned versions in
  `package.json`. ffmpeg is not needed. MP4 is offered only when the browser can encode H.264
  (`GET /api/project/<slug>/design/motion/export-formats`).
- One export runs at a time per project; files go to `projects/<slug>/design/exports/` and are deleted after 24 h.
- Reference machine: 10 s at 30 fps in 1080p takes about 46 s (MP4) and 48 s (WebM).

## Uso no dia a dia

- **Trocar de projeto:** edite `projects/.active` com o nome da pasta.
- **Instruções:** escreva em `instructions.md` (do projeto ou em `global/`). Valem a partir da próxima mensagem, sem reiniciar.
- **Memória:** registre fatos duráveis com `node tools/memory.js save` (veja `node tools/memory.js --help`). Os índices `memory.md` são gerados; não os edite manualmente.
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

- Série de primeiros passos: [01 visão geral](docs/setup/01-overview.pt-BR.md), [02 instalação](docs/setup/02-installation.pt-BR.md), [03 motores e credenciais](docs/setup/03-engines-and-credentials.pt-BR.md), [04 primeira sincronização](docs/setup/04-first-sync.pt-BR.md), [05 adotar projetos existentes](docs/setup/05-adopt-existing-projects.pt-BR.md). Agentes: [docs/agents/BOOTSTRAP.pt-BR.md](docs/agents/BOOTSTRAP.pt-BR.md).
- [Importadores e extração de conversas](docs/setup/importadores.md): Claude Code, Antigravity/Gemini e extração de regras, memórias e documentos.
- [Rotinas, revisão de memória e sincronização](docs/setup/rotinas-e-sync.md): tarefas recorrentes, sugestões de memória, `sync` dos 3 motores e uso com outros agentes.
- [Exportar contexto, interface web e desenvolvimento](docs/setup/interface-e-desenvolvimento.md): exportação para os agentes, interface web, testes, privacidade e problemas comuns.
